const mongoose = require("mongoose");

const recordSchema = new mongoose.Schema(
    {
        academic_year: String,
        round: String,
        seat_category: String,
        sr_no: String,
        all_india_merit: Number,
        percentile: Number,
        choice_code: String,
        college_code: String,
        college_name: String,
        course_name: String,
        exam: String,
        seat_type: String
    },
    { _id: false }
);

const JEE_cutoffs = new mongoose.Schema({
    source_file: String,
    document_type: String,
    academic_year: String,
    round: String,
    total_records: Number,

    records: [recordSchema]
});

module.exports = mongoose.model("Cutoff", JEE_cutoffs, "JEE_cutoffs");