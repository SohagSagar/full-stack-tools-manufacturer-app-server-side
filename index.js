const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const port = process.env.PORT || 5000;

//use middleware//
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.spmmn.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });



async function run() {
    try {
        await client.connect();
        const regularProductCollection = client.db('tire-manufacturer').collection('regularProducts');
        const orderedProductCollection = client.db('tire-manufacturer').collection('OrderedProducts');
        const userReviewCollection = client.db('tire-manufacturer').collection('userReviews');
        console.log('Connected to db');

        //get all regular products
        app.get('/regularProducts', async (req, res) => {
            const query = req.query;
            const cursor = regularProductCollection.find();
            const result = await cursor.toArray();
            res.send(result);
        })

        // get user individual ordered products
        app.get('/my-order', async (req, res) => {
            const customerEmail = req.query.customerEmail;
            const result = await orderedProductCollection.find({ customerEmail }).toArray();
            res.send(result);
        })

        //get purchase product info 
        app.get('/purchase/:id', async (req, res) => {
            const id = req.params.id;
            const result = await regularProductCollection.findOne({ _id: ObjectId(id) });
            res.send(result);
        })

        //get all customer reviews
        app.get('/customer-reviews', async(req,res)=>{
            const result= await userReviewCollection.find().toArray();
            res.send(result);
        })







        // post regular products
        app.post("/regularProducts", async (req, res) => {
            const data = req.body;
            console.log('getting data', data);
            const result = await regularProductCollection.insertOne(data);
            res.send(result);
        })

        //post ordered products
        app.post('/ordered-product', async (req, res) => {
            const data = req.body;
            const result = await orderedProductCollection.insertOne(data);
            res.send(result);

        })

        //post user review
        app.post('/add-review', async(req,res)=>{
            const data=req.body;
            const result= await userReviewCollection.insertOne(data);
            res.send(result);

        })


        //delete my-ordered items
        app.delete('/delete-ordered-item/:id', async(req,res)=>{
            const id =req.params.id;
            const filter ={_id:ObjectId(id)}
            const result = await orderedProductCollection.deleteOne(filter);
            res.send(result);
        })



    }


    finally {

    }
}

run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Running car tire manufacturer server')
});

app.listen(port, () => {
    console.log('Tire Manufacturer server is running at', port);
})