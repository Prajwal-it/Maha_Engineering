import pdfplumber
import re
import json
import argparse
import os


# ---------------------------------------------------------
# CONFIGURATION
# ---------------------------------------------------------

TABLE_SETTINGS = {
    "vertical_strategy": "lines",
    "horizontal_strategy": "lines",
    "snap_tolerance": 3,
    "join_tolerance": 3,
    "edge_min_length": 3,
    "intersection_tolerance": 3
}


# ---------------------------------------------------------
# HELPER FUNCTIONS
# ---------------------------------------------------------

def clean_text(value):
    """
    Clean whitespace and newlines from extracted PDF text.
    """
    if value is None:
        return ""

    value = str(value)
    value = value.replace("\n", " ")
    value = re.sub(r"\s+", " ", value)

    return value.strip()


def normalize_stage(value):
    """
    Converts values such as:

    I
    VII
    I-Non PWD
    I-Non Defence

    into a clean single-line string.
    """

    return clean_text(value)


def extract_cutoff_value(value):
    """
    Extract:

    36195
    (91.4174744)

    into:

    meritRank = 36195
    percentile = 91.4174744
    """

    if not value:
        return None

    value = clean_text(value)

    match = re.search(
        r"(\d+)\s*\(\s*([0-9]+(?:\.[0-9]+)?)\s*\)",
        value
    )

    if not match:
        return None

    return {
        "meritRank": int(match.group(1)),
        "percentile": float(match.group(2))
    }


def parse_status(status_line):
    """
    Example:

    Status: Government Autonomous
    Home University : Autonomous Institute

    Returns:

    {
        status: "Government Autonomous",
        homeUniversity: "Autonomous Institute"
    }
    """

    if not status_line:
        return "", ""

    text = clean_text(status_line)

    match = re.match(
        r"Status:\s*(.*?)\s+Home University\s*:\s*(.*)",
        text,
        re.IGNORECASE
    )

    if match:
        return (
            match.group(1).strip(),
            match.group(2).strip()
        )

    return text.replace("Status:", "").strip(), ""


def get_section_name(lines, table_top):
    """
    Finds the section belonging to a table.

    Possible sections in the Maharashtra CAP PDF include:

    Home University Seats Allotted to Home University Candidates
    Other Than Home University Seats Allotted to Other Than Home University Candidates
    Other Than Home University Seats Allotted to Home University Candidates
    State Level
    """

    section = "Unknown"

    for line in lines:
        if line["top"] >= table_top:
            break

        text = clean_text(line["text"])

        if (
            "Seats Allotted" in text
            or text == "State Level"
        ):
            section = text

    return section


def normalize_section(section):
    """
    Converts long PDF headings into easier database values.
    """

    section = clean_text(section)

    if section == "Home University Seats Allotted to Home University Candidates":
        return "Home University"

    if section == "Other Than Home University Seats Allotted to Other Than Home University Candidates":
        return "Other Than Home University"

    if section == "Other Than Home University Seats Allotted to Home University Candidates":
        return "Home University Candidate - Other Than Home University Seats"

    if section == "State Level":
        return "State Level"

    return section


# ---------------------------------------------------------
# EXTRACT DOCUMENT INFORMATION
# ---------------------------------------------------------

def extract_document_metadata(pdf):

    first_page = pdf.pages[0]

    text = first_page.extract_text() or ""

    round_match = re.search(
        r"CAP Round\s*-\s*([IVX]+)",
        text,
        re.IGNORECASE
    )

    year_match = re.search(
        r"A\.Y\.\s*(\d{4}-\d{2})",
        text,
        re.IGNORECASE
    )

    round_number = (
        round_match.group(1)
        if round_match
        else "Unknown"
    )

    academic_year = (
        year_match.group(1)
        if year_match
        else "Unknown"
    )

    return {
        "exam": "MHT-CET",
        "round": round_number,
        "academicYear": academic_year
    }


# ---------------------------------------------------------
# MAIN EXTRACTION FUNCTION
# ---------------------------------------------------------

def convert_pdf_to_json(pdf_path, output_path):

    records = []

    failed_pages = []

    total_pages = 0
    total_tables = 0

    print("\n========================================")
    print(" Maharashtra Engineering Cutoff Parser")
    print("========================================\n")

    print(f"Input PDF : {pdf_path}")
    print(f"Output    : {output_path}\n")

    with pdfplumber.open(pdf_path) as pdf:

        total_pages = len(pdf.pages)

        metadata = extract_document_metadata(pdf)

        print(f"Pages found : {total_pages}")
        print(f"Exam        : {metadata['exam']}")
        print(f"Round       : {metadata['round']}")
        print(f"Academic Yr : {metadata['academicYear']}")
        print("\nProcessing...\n")

        for page_number, page in enumerate(pdf.pages, start=1):

            try:

                # ---------------------------------------------
                # Extract text lines with coordinates
                # ---------------------------------------------

                lines = page.extract_text_lines()

                if not lines:
                    failed_pages.append(page_number)
                    continue

                # ---------------------------------------------
                # Find college / branch / status information
                # ---------------------------------------------

                colleges = []
                branches = []
                statuses = []

                for line in lines:

                    text = clean_text(line["text"])
                    top = line["top"]

                    # College code = 5 digits
                    college_match = re.match(
                        r"^(\d{5})\s*-\s*(.+)$",
                        text
                    )

                    if college_match:

                        colleges.append({
                            "top": top,
                            "code": college_match.group(1),
                            "name": college_match.group(2).strip()
                        })

                    # Course/branch code = 10 digits
                    branch_match = re.match(
                        r"^(\d{10})\s*-\s*(.+)$",
                        text
                    )

                    if branch_match:

                        branches.append({
                            "top": top,
                            "code": branch_match.group(1),
                            "name": branch_match.group(2).strip()
                        })

                    # Status
                    if text.startswith("Status:"):

                        statuses.append({
                            "top": top,
                            "text": text
                        })

                # ---------------------------------------------
                # Extract tables
                # ---------------------------------------------

                tables = page.find_tables(
                    table_settings=TABLE_SETTINGS
                )

                total_tables += len(tables)

                if not tables:
                    continue

                # Ensure tables are ordered vertically
                tables = sorted(
                    tables,
                    key=lambda table: table.bbox[1]
                )

                for table in tables:

                    table_top = table.bbox[1]

                    # -----------------------------------------
                    # Find college belonging to this table
                    # -----------------------------------------

                    current_college = None

                    for college in colleges:

                        if college["top"] < table_top:
                            current_college = college

                    # -----------------------------------------
                    # Find branch belonging to this table
                    # -----------------------------------------

                    current_branch = None

                    for branch in branches:

                        if branch["top"] < table_top:
                            current_branch = branch

                    # -----------------------------------------
                    # Find status belonging to this table
                    # -----------------------------------------

                    current_status = None

                    for status in statuses:

                        if status["top"] < table_top:
                            current_status = status

                    # -----------------------------------------
                    # Validate basic information
                    # -----------------------------------------

                    if not current_college:
                        print(
                            f"WARNING: College not found "
                            f"on page {page_number}"
                        )
                        continue

                    if not current_branch:
                        print(
                            f"WARNING: Branch not found "
                            f"on page {page_number}"
                        )
                        continue

                    # -----------------------------------------
                    # Get section
                    # -----------------------------------------

                    section = get_section_name(
                        lines,
                        table_top
                    )

                    section = normalize_section(section)

                    # -----------------------------------------
                    # Parse status
                    # -----------------------------------------

                    status = ""
                    home_university = ""

                    if current_status:

                        status, home_university = parse_status(
                            current_status["text"]
                        )

                    # -----------------------------------------
                    # Extract actual table
                    # -----------------------------------------

                    rows = table.extract()

                    if not rows:
                        continue

                    # -----------------------------------------
                    # First row contains categories
                    #
                    # Example:
                    #
                    # [None,
                    #  GOPENH,
                    #  GSCH,
                    #  GOBCH,
                    #  ...]
                    # -----------------------------------------

                    header = rows[0]

                    if not header:
                        continue

                    categories = []

                    for cell in header[1:]:

                        category = clean_text(cell)

                        categories.append(category)

                    # -----------------------------------------
                    # Process every cutoff row
                    # -----------------------------------------

                    for row in rows[1:]:

                        if not row:
                            continue

                        # First column = stage
                        stage = normalize_stage(row[0])

                        if not stage:
                            continue

                        # -------------------------------------
                        # Match each table cell with its category
                        # -------------------------------------

                        for index, category in enumerate(categories):

                            if not category:
                                continue

                            cell_index = index + 1

                            if cell_index >= len(row):
                                continue

                            cell_value = row[cell_index]

                            cutoff = extract_cutoff_value(
                                cell_value
                            )

                            if not cutoff:
                                continue

                            record = {

                                "exam": metadata["exam"],

                                "academicYear":
                                    metadata["academicYear"],

                                "capRound":
                                    metadata["round"],

                                "collegeCode":
                                    current_college["code"],

                                "collegeName":
                                    current_college["name"],

                                "courseCode":
                                    current_branch["code"],

                                "branch":
                                    current_branch["name"],

                                "collegeStatus":
                                    status,

                                "homeUniversity":
                                    home_university,

                                "seatLevel":
                                    section,

                                "category":
                                    category,

                                "stage":
                                    stage,

                                "meritRank":
                                    cutoff["meritRank"],

                                "percentile":
                                    cutoff["percentile"],

                                "sourcePage":
                                    page_number
                            }

                            records.append(record)

                # ---------------------------------------------
                # Progress
                # ---------------------------------------------

                if page_number % 25 == 0:

                    print(
                        f"Processed {page_number}/{total_pages} pages "
                        f"| Records: {len(records)}"
                    )

            except Exception as error:

                failed_pages.append(page_number)

                print(
                    f"ERROR on page {page_number}: {error}"
                )

    # ---------------------------------------------------------
    # REMOVE DUPLICATES
    # ---------------------------------------------------------

    unique_records = []
    seen = set()

    for record in records:

        key = (
            record["academicYear"],
            record["capRound"],
            record["collegeCode"],
            record["courseCode"],
            record["seatLevel"],
            record["category"],
            record["stage"],
            record["meritRank"],
            record["percentile"]
        )

        if key not in seen:

            seen.add(key)
            unique_records.append(record)

    # ---------------------------------------------------------
    # SAVE JSON
    # ---------------------------------------------------------

    with open(
        output_path,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            unique_records,
            file,
            indent=2,
            ensure_ascii=False
        )

    # ---------------------------------------------------------
    # SAVE FAILED PAGES
    # ---------------------------------------------------------

    failed_path = os.path.splitext(
        output_path
    )[0] + "_failed_pages.json"

    with open(
        failed_path,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            failed_pages,
            file,
            indent=2
        )

    # ---------------------------------------------------------
    # FINAL SUMMARY
    # ---------------------------------------------------------

    print("\n========================================")
    print(" Extraction Completed")
    print("========================================")

    print(f"Total PDF pages : {total_pages}")
    print(f"Total tables    : {total_tables}")
    print(f"Raw records     : {len(records)}")
    print(f"Unique records  : {len(unique_records)}")
    print(f"Failed pages    : {len(failed_pages)}")

    print(f"\nJSON saved to:")
    print(output_path)

    print(f"\nFailed pages saved to:")
    print(failed_path)

    print("\n========================================\n")


# ---------------------------------------------------------
# COMMAND LINE
# ---------------------------------------------------------

if __name__ == "__main__":

    parser = argparse.ArgumentParser(
        description=
        "Convert Maharashtra Engineering CAP cutoff PDF to JSON"
    )

    parser.add_argument(
        "pdf",
        help="Path to input PDF"
    )

    parser.add_argument(
        "-o",
        "--output",
        default="cutoffs.json",
        help="Output JSON filename"
    )

    args = parser.parse_args()

    if not os.path.exists(args.pdf):

        print(
            f"ERROR: File not found: {args.pdf}"
        )

        exit(1)

    convert_pdf_to_json(
        args.pdf,
        args.output
    )