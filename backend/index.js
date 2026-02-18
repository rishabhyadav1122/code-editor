import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from 'path'
import axios from 'axios'
import dotenv from "dotenv";
dotenv.config();


const app = express();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const rooms = new Map();

io.on("connection", (socket) => {
  console.log("User Connected", socket.id);

  let currentRoom = null;
  let currentUser = null;

  socket.on("join", ({ roomId, userName }) => {
    if (currentRoom) {
      socket.leave(currentRoom);
      rooms.get(currentRoom).delete(currentUser);
      io.to(currentRoom).emit("userJoined", Array.from(rooms.get(currentRoom)));
    }
    currentRoom = roomId;
    currentUser = userName;
    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }

    rooms.get(roomId).add(userName);

    io.to(roomId).emit("userJoined", Array.from(rooms.get(currentRoom)));
    console.log('user joined room-',roomId)
  });

  socket.on("codeChange",({roomId,code})=>{
    socket.to(roomId).emit("codeUpdate",code)
  })

  socket.on("leaveRoom",()=>{
    if(currentRoom && currentUser){
        rooms.get(currentRoom).delete(currentUser)
        io.to(currentRoom).emit("userJoined", Array.from(rooms.get(currentRoom)));

        socket.leave(currentRoom)

        currentRoom=null;
        currentUser=null;
    }
  })

  socket.on("typing",({roomId,userName})=>{
    socket.to(roomId).emit("userTyping",userName)
  })

  socket.on("languageChange" ,({roomId,language})=>{
    io.to(roomId).emit("languageUpdate",language)
  })

 socket.on("compileCode", async ({ code, roomId, language }) => {
  try {
    if (!rooms.has(roomId)) return;

    const languageMap = {
      javascript: 63, // Node.js
      python: 71,
      java: 62,
      cpp: 54,
    };

    const response = await axios.post(
      "https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=false&wait=true",
      {
        source_code: code,
        language_id: languageMap[language],
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
          "X-RapidAPI-Key": process.env.RAPID_API_KEY,
        },
      }
    );

    io.to(roomId).emit("codeResponse", {
      run: {
        output:
          response.data.stdout ||
          response.data.stderr ||
          response.data.compile_output ||
          "No Output",
      },
    });

  } catch (error) {
    console.error("Execution error:", error.message);

    io.to(roomId).emit("codeResponse", {
      run: {
        output: "Execution Failed",
      },
    });
  }
});


  socket.on("disconnect",()=>{
    if(currentRoom && currentUser){
        rooms.get(currentRoom).delete(currentUser)
        io.to(currentRoom).emit("userJoined", Array.from(rooms.get(currentRoom)));
    }
    console.log("user disconnected")
  })
});

const port = process.env.PORT || 5000;

const __dirname = path.resolve()

app.use(express.static(path.join(__dirname,"/frontend/dist")))


app.get("*",(req,res)=>{
    res.sendFile(path.join(__dirname,"frontend","dist","index.html"))
})

server.listen(port, () => {
  console.log(`Server is Working on Port ${port}`);
});
