import { createRemoteJWKSet, jwtVerify } from "jose";
import express from "express"
import cors from "cors"
import { MongoClient, ObjectId } from 'mongodb';
import 'dotenv/config'

const app = express()
const PORT = process.env.PORT || 8000;


app.use(cors())
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI);
export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}


const connectClient = await connectToMongoDB()
const db = connectClient.db("social-develop")
const eventClollection = db.collection('events')
const joinEventCollection = db.collection("join-event")



const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)
);

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({
      msg: "Unauthorized: Token missing",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const { payload } = await jwtVerify(token, JWKS);

    req.user = payload;

    console.log("Verified user:", payload);

    next();
  } catch (error) {
    console.error("JWT verification error:", error);

    return res.status(401).json({
      msg: "Unauthorized: Invalid token",
    });
  }
};


app.post("/add-events", verifyToken, async(req, res)=>{
    const data = req.body
    const result = await eventClollection.insertOne(data)
    console.log(result);
    res.json(result)
})

app.get('/events', async(req, res)=>{
    const result = await eventClollection.find().toArray()
    console.log("Total events:", result.length);
    res.send(result)
})


app.get("/events/:id", verifyToken,  async(req, res)=>{
    const {id} = req.params
    const result = await eventClollection.findOne({_id: new ObjectId(id)})
    res.json(result)
})

// 6 nearest upcoming events (created via Create Event page), soonest date first
app.get('/recent-upcoming-events', async(req, res)=>{
    const today = new Date().toISOString().slice(0, 10) // "YYYY-MM-DD"
    const result = await eventClollection
        .find({ date: { $gte: today } })
        .sort({ date: 1 })
        .limit(6)
        .toArray()
    res.send(result)
})


app.post("/join-event/event",  async (req, res) => {
  try {
    const joinData = req.body;

    // Check duplicate joining
    const alreadyJoined = await joinEventCollection.findOne({
      email: joinData.email,
      eventId: joinData.eventId,
    });

    if (alreadyJoined) {
      return res.status(409).json({
        success: false,
        message: "You have already joined this event!",
      });
    }

    // Insert joining data
    const result = await joinEventCollection.insertOne(joinData);

    return res.status(201).json({
      success: true,
      message: "Successfully joined the event!",
      insertedId: result.insertedId,
    });

  } catch (error) {
    console.error("Join event error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to join event",
    });
  }
});


app.get("/joining/:email", async(req, res)=>{
    const {email} = req.params
    const result = await joinEventCollection.find({email:email}).toArray()
    res.json(result)
})

app.get("/manage-events/:email", async(req, res)=>{
    const today = new Date().toISOString().slice(0, 10)
    const {email} = req.params
    const result = await eventClollection.find({createEmail: email, 
        date: { $gte: today }})
        .sort({ date: 1 }).toArray()
    console.log(result);
    res.json(result)
})

app.patch("/manage-events/:id", verifyToken, async(req, res)=>{
    const {id} = req.params
    const updatedData = req.body
    const result = await eventClollection.updateOne({_id: new ObjectId(id)},
    {$set: updatedData});
    res.json(result)
})

app.delete("/manage-events/:id", verifyToken, async(req, res)=>{
    const {id} = req.params;
    const result = await eventClollection.deleteOne({_id : new ObjectId(id)})
    res.send(result)
})

app.get("/", (req, res)=>{
  res.send({message: " running file!"})
})


app.listen(PORT, ()=>{
    console.log(`Server is running on port ${PORT}`);
})

export default app;