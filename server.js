const express=require('express');
const app=express();
const router=require('./routes/cutoffroutes');
const mongoose=require('mongoose');
app.use(express.json());
app.use(router);
mongoose.connect('mongodb://localhost:27017/MahaEngineering')
  .then(() => {
    console.log('Connected to MongoDB'); 
    })
    .catch((err)=>{
        console.log(err);
    })
app.listen(3000,()=>{
    console.log("Server started on port 3000");
})