const db=require('../model/cutoffSchema');
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

};

module.exports={getcutoffs,getcutoffsById,getCutoffsByCourse};