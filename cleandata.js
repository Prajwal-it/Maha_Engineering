const fs = require("fs");
const path = require("path");

// ======================================================
// 1. INPUT FILES
// ======================================================

const inputFiles = [
    "./cutoff_Data/2023.json",
    "./cutoff_Data/2024.json",
    "./cutoff_Data/2025.json"
];

const outputFolder = "./cleaned";

if (!fs.existsSync(outputFolder)) {
    fs.mkdirSync(outputFolder);
}


// ======================================================
// 2. HELPER FUNCTIONS
// ======================================================

// Extract college code from:
// "06265 - Walchand Institute of Technology, Solapur"
function extractCollegeCode(collegeName) {

    if (!collegeName) {
        return null;
    }

    const match = collegeName.match(/^(\d{4,5})\s*-/);

    return match ? match[1] : null;
}


// Remove college code from college name
function cleanCollegeName(collegeName) {

    if (!collegeName) {
        return null;
    }

    return collegeName
        .replace(/^\d{4,5}\s*-\s*/, "")
        .replace(/\s+/g, " ")
        .trim();
}


// Clean spaces
function cleanText(value) {

    if (value === null || value === undefined) {
        return null;
    }

    return String(value)
        .replace(/\s+/g, " ")
        .trim();
}

// Create a key from choice code
//
// Example:
// 0626524210
//
// college code = 06265
// course code  = 242
// seat suffix  = 10
//
function getCourseCode(choiceCode) {

    if (!choiceCode) {
        return null;
    }

    const code = String(choiceCode);

    if (code.length < 8) {
        return null;
    }

    return code.substring(5, code.length - 2);
}


// ======================================================
// 3. READ ALL FILES
// ======================================================

let allRecords = [];

for (const file of inputFiles) {

    if (!fs.existsSync(file)) {

        console.log(`⚠ File not found: ${file}`);
        continue;
    }

    console.log(`Reading: ${file}`);

    const json = JSON.parse(
        fs.readFileSync(file, "utf8")
    );

    // --------------------------------------------------
    // Case 1:
    // File contains { records: [] }
    // --------------------------------------------------

    if (Array.isArray(json.records)) {

        allRecords.push(...json.records);

    }

    // --------------------------------------------------
    // Case 2:
    // File itself is an array
    // --------------------------------------------------

    else if (Array.isArray(json)) {

        allRecords.push(...json);

    }

    else {

        console.log(`⚠ Unknown JSON structure: ${file}`);
    }
}

console.log("\n=================================");
console.log("TOTAL RAW RECORDS:", allRecords.length);
console.log("=================================\n");


// ======================================================
// 4. BUILD COLLEGE NAME MAP
// ======================================================
//
// We use repeated records to determine the proper
// college name for each college code.
//

const collegeMap = new Map();

for (const record of allRecords) {

    const rawName = cleanText(record.college_name);

    if (!rawName) {
        continue;
    }

    const collegeCode = extractCollegeCode(rawName);

    if (!collegeCode) {
        continue;
    }

    const cleanName = cleanCollegeName(rawName);

    if (!collegeMap.has(collegeCode)) {

        collegeMap.set(collegeCode, new Map());
    }

    const names = collegeMap.get(collegeCode);

    names.set(
        cleanName,
        (names.get(cleanName) || 0) + 1
    );
}


// ======================================================
// 5. GET MOST COMMON COLLEGE NAME
// ======================================================

const canonicalCollegeMap = new Map();

for (const [collegeCode, names] of collegeMap.entries()) {

    let bestName = null;
    let bestCount = 0;

    for (const [name, count] of names.entries()) {

        if (count > bestCount) {

            bestName = name;
            bestCount = count;
        }
    }

    canonicalCollegeMap.set(
        collegeCode,
        bestName
    );
}


// ======================================================
// 6. BUILD COURSE MAP
// ======================================================
//
// We use choice_code to identify courses.
//
// This allows us to repair records where
// course_name is missing or corrupted.
//

const courseMap = new Map();

for (const record of allRecords) {

    const choiceCode = cleanText(record.choice_code);

    const courseName = cleanText(record.course_name);

    if (!choiceCode || !courseName) {
        continue;
    }

    const courseCode = getCourseCode(choiceCode);

    if (!courseCode) {
        continue;
    }

    if (!courseMap.has(courseCode)) {

        courseMap.set(courseCode, new Map());
    }

    const courses = courseMap.get(courseCode);

    courses.set(
        courseName,
        (courses.get(courseName) || 0) + 1
    );
}


// ======================================================
// 7. GET CANONICAL COURSE NAME
// ======================================================

const canonicalCourseMap = new Map();

for (const [courseCode, courses] of courseMap.entries()) {

    let bestCourse = null;
    let bestCount = 0;

    for (const [course, count] of courses.entries()) {

        if (count > bestCount) {

            bestCourse = course;
            bestCount = count;
        }
    }

    canonicalCourseMap.set(
        courseCode,
        bestCourse
    );
}


// ======================================================
// 8. CLEAN RECORDS
// ======================================================

let cleanedRecords = [];

let statistics = {

    totalRecords: allRecords.length,

    collegeCodeAdded: 0,

    collegeNameCleaned: 0,

    courseNameFixed: 0,

    courseNameAlreadyPresent: 0,

    unresolvedCollege: 0,

    unresolvedCourse: 0,

    invalidRecords: 0
};


for (const record of allRecords) {

    if (!record || typeof record !== "object") {

        statistics.invalidRecords++;

        continue;
    }


    // --------------------------------------------------
    // COLLEGE CODE
    // --------------------------------------------------

    let collegeCode =
        cleanText(record.college_code);


    const rawCollegeName =
        cleanText(record.college_name);


    // If college_code is missing,
    // extract it from college_name

    if (!collegeCode && rawCollegeName) {

        collegeCode =
            extractCollegeCode(rawCollegeName);

        if (collegeCode) {

            statistics.collegeCodeAdded++;
        }
    }


    // --------------------------------------------------
    // COLLEGE NAME
    // --------------------------------------------------

    let collegeName = null;


    if (collegeCode &&
        canonicalCollegeMap.has(collegeCode)) {

        collegeName =
            canonicalCollegeMap.get(collegeCode);

    }

    else if (rawCollegeName) {

        collegeName =
            cleanCollegeName(rawCollegeName);
    }


    if (!collegeName) {

        statistics.unresolvedCollege++;
    }

    else if (
        rawCollegeName &&
        collegeName !== rawCollegeName
    ) {

        statistics.collegeNameCleaned++;
    }


    // --------------------------------------------------
    // COURSE NAME
    // --------------------------------------------------

    const choiceCode =
        cleanText(record.choice_code);


    const courseCode =
        getCourseCode(choiceCode);


    let courseName =
        cleanText(record.course_name);


    // Try to get canonical course name
    // from choice code

    if (courseCode &&
        canonicalCourseMap.has(courseCode)) {

        const canonicalCourse =
            canonicalCourseMap.get(courseCode);


        // Missing course
        if (!courseName) {

            courseName =
                canonicalCourse;

            statistics.courseNameFixed++;
        }

        // Existing but possibly corrupted course
        else if (courseName !== canonicalCourse) {

            courseName =
                canonicalCourse;

            statistics.courseNameFixed++;
        }

        else {

            statistics.courseNameAlreadyPresent++;
        }
    }


    if (!courseName) {

        statistics.unresolvedCourse++;
    }


    // ==================================================
    // CREATE CLEAN RECORD
    // ==================================================

    const cleanRecord = {

        academic_year:
            cleanText(record.academic_year),

        round:
            cleanText(record.round),

        seat_category:
            cleanText(record.seat_category),

        sr_no:
            cleanText(record.sr_no),

        all_india_merit:
            record.all_india_merit ?? null,

        percentile:
            record.percentile ?? null,

        choice_code:
            choiceCode,

        college_code:
            collegeCode,

        college_name:
            collegeName,

        course_name:
            courseName,

        exam:
            cleanText(record.exam),

        seat_type:
            cleanText(record.seat_type)
    };


    cleanedRecords.push(cleanRecord);
}


// ======================================================
// 9. REMOVE EXACT DUPLICATES
// ======================================================

const uniqueRecords = [];

const seen = new Set();

for (const record of cleanedRecords) {

    const key = JSON.stringify(record);

    if (!seen.has(key)) {

        seen.add(key);

        uniqueRecords.push(record);
    }
}


const duplicatesRemoved =
    cleanedRecords.length - uniqueRecords.length;


// ======================================================
// 10. SORT RECORDS
// ======================================================

uniqueRecords.sort((a, b) => {

    return (
        String(a.college_code || "")
            .localeCompare(
                String(b.college_code || "")
            )
        ||
        String(a.course_name || "")
            .localeCompare(
                String(b.course_name || "")
            )
        ||
        String(a.academic_year || "")
            .localeCompare(
                String(b.academic_year || "")
            )
    );
});


// ======================================================
// 11. FINAL OUTPUT
// ======================================================

const finalData = {

    total_records:
        uniqueRecords.length,

    duplicates_removed:
        duplicatesRemoved,

    records:
        uniqueRecords
};


// ======================================================
// 12. SAVE CLEAN DATA
// ======================================================

fs.writeFileSync(

    path.join(
        outputFolder,
        "cleaned_cutoffs.json"
    ),

    JSON.stringify(
        finalData,
        null,
        2
    ),

    "utf8"
);


// ======================================================
// 13. SAVE CLEANING REPORT
// ======================================================

statistics.finalRecords =
    uniqueRecords.length;

statistics.duplicatesRemoved =
    duplicatesRemoved;


fs.writeFileSync(

    path.join(
        outputFolder,
        "cleaning_report.json"
    ),

    JSON.stringify(
        statistics,
        null,
        2
    ),

    "utf8"
);


// ======================================================
// 14. DISPLAY RESULT
// ======================================================

console.log("\n=================================");
console.log("CLEANING COMPLETED");
console.log("=================================");

console.log(
    "Raw records:",
    statistics.totalRecords
);

console.log(
    "Final records:",
    statistics.finalRecords
);

console.log(
    "College codes added:",
    statistics.collegeCodeAdded
);

console.log(
    "College names cleaned:",
    statistics.collegeNameCleaned
);

console.log(
    "Course names fixed:",
    statistics.courseNameFixed
);

console.log(
    "Unresolved colleges:",
    statistics.unresolvedCollege
);

console.log(
    "Unresolved courses:",
    statistics.unresolvedCourse
);

console.log(
    "Duplicates removed:",
    statistics.duplicatesRemoved
);

console.log("\nFiles created:");

console.log(
    "✓ cleaned/cleaned_cutoffs.json"
);

console.log(
    "✓ cleaned/cleaning_report.json"
);