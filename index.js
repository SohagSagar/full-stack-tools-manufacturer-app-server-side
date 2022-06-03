const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;

//use middleware//
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.spmmn.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


// https://vast-forest-24784.herokuapp.com/
// http://localhost:5000/


const verifyJWT = (req, res, next) => {
    // const authorization=req.headers.authorization;
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).send({ message: 'UnAuthorized access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'forbidden access' })
        }
        req.decoded = decoded;
        next();
    })

}

async function run() {
    try {
        await client.connect();
        const regularProductCollection = client.db('tire-manufacturer').collection('regularProducts');
        const orderedProductCollection = client.db('tire-manufacturer').collection('OrderedProducts');
        const userReviewCollection = client.db('tire-manufacturer').collection('userReviews');
        const userCollection = client.db('tire-manufacturer').collection('users');

        console.log('Connected to db');

        //stripe payment intent
        app.post('/create-payment-intent', async (req, res) => {
            const price = req.body;
            // console.log('price',price.totalPrice, typeof price.totalPrice); 
            const totalPrice = price.totalPrice;

            const amount = totalPrice * 100;

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "bdt",
                payment_method_types: ['card']

            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        })

        //get all regular products
        app.get('/regularProducts', async (req, res) => {
            const query = req.query;
            // const authorization=req.headers.authorization;
            // console.log(authorization);
            const result = await regularProductCollection.find().toArray();
            res.send(result);
        })

        // get user individual ordered products
        app.get('/my-order', verifyJWT, async (req, res) => {
            const customerEmail = req.query.customerEmail;
            const decodedEmail = req.decoded.email;
            if (customerEmail !== decodedEmail) {
                return res.status(403).send({ message: 'forbidden access' })
            }
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
        app.get('/customer-reviews', async (req, res) => {
            const result = await userReviewCollection.find().toArray();
            res.send(result);
        })

        //get all users
        app.get('/all-users', verifyJWT, async (req, res) => {
            const users = await userCollection.find().toArray();
            res.send(users);
        })

        //get an admin
        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email });
            const isAdmin = user?.role === 'admin';
            res.send({ admin: isAdmin });
        })

        //get all regular products
        app.get('/regular-product', async (req, res) => {
            const result = await regularProductCollection.find().toArray();
            res.send(result);
        })

 

        //get payment info
        app.get('/payment-info/:id', async (req, res) => {
            const id = req.params.id;
            const result = await orderedProductCollection.findOne({ _id: ObjectId(id) });
            res.send(result);
        })

        //get all ordered products
        app.get('/orders',verifyJWT, async(req,res)=>{
            const result = await orderedProductCollection.find().toArray();
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
        app.post('/add-review', async (req, res) => {
            const data = req.body;
            const result = await userReviewCollection.insertOne(data);
            res.send(result);

        })




        //update available quantity after place a successful order
        app.put('/regularProducts/:id',async(req,res)=>{
            const id= req.params.id;
            console.log('object',id);
            const available=req.body;
            const options={upsert:true};
            const filter = { _id: ObjectId(id) };
            // console.log('updatedQuantity',updatedQuantity);
            const updatedDoc={
                $set:{
                    ...available
                }
            }
            console.log('updatedDoc',updatedDoc);
            const result= await regularProductCollection.updateOne(filter,updatedDoc,options);
            res.send(result);
        })

        //post user from login/singnup/google login
        app.put('/users/:email', async (req, res) => {

            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updatedDoc = {
                $set: user
            };
            const result = await userCollection.updateOne(filter, updatedDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ result, token });
        })

        // post make user an admin
        app.put('/user/makeAdmin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            console.log(email);
            const filter = { email: email };
            const updatedDoc = {
                $set: { role: 'admin' }
            }
            const result = await userCollection.updateOne(filter, updatedDoc);
            res.send(result)
        })

        //remove an user from admin role
        app.put('/user/removeAdmin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            console.log(email);
            const filter = { email: email };
            const updatedDoc = {
                $set: { role: '' }
            }
            const result = await userCollection.updateOne(filter, updatedDoc);
            res.send(result)
        })

        //post payment info into purchased order
        app.put('/order/:id', async (req, res) => {
            const id = req.params.id;
            const paymentSuccessInfo = req.body;   
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    ...paymentSuccessInfo
                }
            }
            const result = await orderedProductCollection.updateOne(filter,updatedDoc,options);
            res.send(result);
        })


        //delete my-ordered items
        app.delete('/delete-ordered-item/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const result = await orderedProductCollection.deleteOne(filter);
            res.send(result);
        })

        //delete a user 
        app.delete('/user/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await userCollection.deleteOne(filter);
            res.send(result);

        })

        //delete regular product
        app.delete('/regularProduct/delete/:id', async (req, res) => {
            const id = req.params.id;
            const result = await regularProductCollection.deleteOne({ _id: ObjectId(id) });
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