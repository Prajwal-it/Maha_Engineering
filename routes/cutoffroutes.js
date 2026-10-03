const {getcutoffs,getcutoffsById,getCutoffsByCourse}=require('../controllers/cutoffcontroller');
const router=require('express').Router();
router.get('/cutoffs',getcutoffs);
router.get("/cutoffs/course/:course", getCutoffsByCourse);
router.get('/cutoffs/:id',getcutoffsById);
module.exports=router;