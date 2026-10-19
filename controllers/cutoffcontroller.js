const db=require('../model/cutoffSchema');
const normalizeValue = (value) => String(value || "").trim().toLowerCase();
const normalizeCollegeCode = (value) => String(value || "").replace(/^0+/, "") || "0";

const getRequestedFilters = (query) => ({
  academic_year: query.year,
  round: query.round,
  seat_category: query.category,
  course_name: query.course,
  exam: query.exam,
  seat_type: query.seatType
});

const matchesFilters = (record, filters) =>
  Object.entries(filters).every(([field, value]) =>
    value === undefined || normalizeValue(record[field]) === normalizeValue(value)
  );

const getcutoffs=async(req,res)=>{
    try{
        const cutoffs=await db.find();
        res.status(200).json(cutoffs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getcutoffsById=async(req,res)=>{
    try{
        const id=req.params.id;
        const cutoffs=await db.findById(id);
        res.status(200).json({cutoffs});
    }
    catch(err){
        res.status(500).json({message:err.message});
    }
}

const getCutoffsByCourse = async (req, res) => {

    try {

        const course = req.params.course;

        const data = await db.find();

        const result = data.map(item =>
            item.records.filter(record =>
                record.course_name === course
            )
        );

        res.json(result);

    } catch (error) {

        res.status(500).json({
            message: error.message
        });

    }
}


const getCutoffsByCollege = async (req, res) => {
    try {
        const collegeCode = req.params.college;

        const data = await db.find({});

        const result = [];

        data.forEach(document => {

            const records = document.records.filter(
                record =>
                    record.college_code === collegeCode
            );

            result.push(...records);
        });

        if (result.length === 0) {

            return res.status(404).json({
                message: "College not found"
            });
        }

        res.status(200).json({
            college_code: collegeCode,
            college_name: result[0].college_name,
            total_records: result.length,
            records: result
        });

    } catch (error) {

        res.status(500).json({
            message: error.message
        });
    }
};

const getcutoffsByYear=async(req,res)=>{
    const year=req.params.year;
    const data=await db.find({});
    let result=[];
    data.forEach((doc)=>{
        doc.records.forEach((record)=>{
            if(record.academic_year===year)
            {
                result.push(record);
            }
        })
    })
    res.json(result);
}

const getCutoffsByRound = async (req, res) => {
  const round = req.params.round;

  const data = await db.find({});
  let result = [];

  data.forEach((doc) => {
    doc.records.forEach((record) => {
      if (record.round === round) {
        result.push(record);
      }
    });
  });

  res.json(result);
};


const getCutoffsByCategory = async (req, res) => {
  const category = req.params.category;

  const data = await db.find({});
  let result = [];

  data.forEach((doc) => {
    doc.records.forEach((record) => {
      if (record.seat_category === category) {
        result.push(record);
      }
    });
  });

  res.json(result);
};

const getCutoffsByExam = async (req, res) => {
  try {
    const exam = req.params.exam;
    const data = await db.find({});
    const result = data.flatMap(doc =>
      doc.records.filter(record => record.exam === exam)
    );

    if (result.length === 0) {
      return res.status(404).json({ message: "No cutoffs found for this exam" });
    }

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getCutoffsBySeatType = async (req, res) => {
  try {
    const seatType = req.params.seatType;
    const data = await db.find({});
    const result = data.flatMap(doc =>
      doc.records.filter(record => record.seat_type === seatType)
    );

    if (result.length === 0) {
      return res.status(404).json({ message: "No cutoffs found for this seat type" });
    }

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getCollegeCutoffsWithFilters = async (req, res) => {
  try {
    const collegeCode = normalizeCollegeCode(req.params.collegeCode);
    const filters = getRequestedFilters(req.query);
    const data = await db.find({});
    const result = data.flatMap(doc =>
      doc.records.filter(record =>
        normalizeCollegeCode(record.college_code) === collegeCode &&
        matchesFilters(record, filters)
      )
    );

    if (result.length === 0) {
      return res.status(404).json({ message: "No cutoffs found for this college and filters" });
    }

    res.status(200).json({
      college_code: result[0].college_code,
      college_name: result[0].college_name,
      total_records: result.length,
      records: result
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getCutoffsWithFilters = async (req, res) => {
  try {
    const filters = getRequestedFilters(req.query);
    const collegeCode = req.query.collegeCode;
    const data = await db.find({});
    const result = data.flatMap(doc =>
      doc.records.filter(record =>
        (!collegeCode || normalizeCollegeCode(record.college_code) === normalizeCollegeCode(collegeCode)) &&
        matchesFilters(record, filters)
      )
    );

    if (result.length === 0) {
      return res.status(404).json({ message: "No cutoffs found for these filters" });
    }

    res.status(200).json({
      total_records: result.length,
      records: result
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports={getcutoffs,getcutoffsById,getCutoffsByCourse,getCutoffsByCollege,getcutoffsByYear,getCutoffsByRound,getCutoffsByCategory,getCutoffsByExam,getCutoffsBySeatType,getCollegeCutoffsWithFilters,getCutoffsWithFilters};
