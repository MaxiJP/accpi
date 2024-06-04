const express = require ('express');
const sqlite3 = require('sqlite3').verbose();
const jwt = require("jsonwebtoken");

const maxdb = new sqlite3.Database('maxaccpi.db');

maxdb.serialize(() => {
    maxdb.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT, maxcoins INTEGER)");
});

const maxapi = express();
maxapi.use(express.json());

const PORT = process.env.PORT || 19800;

maxapi.listen(PORT, () => {
    console.log("ACCPI listening on port " + PORT);
});

maxapi.get("/status", (req, res) => {
    const resp = {
        "Status": "fine m8"
    };

    res.send(resp);
});

maxapi.post("/user/create", (req, res) => {
    try {
        const { username, password } = req.body;
        maxdb.run("INSERT INTO users (username, password, maxcoins) VALUES (?, ?, 0)", [username, password], function(error) {
            if (error) {
                console.error(error);
                return res.status(400).send("Username taken");
            }
            res.status(201).send("Account created!");
        });
    } catch (err) {
        console.log(err);
        res.status(500).send("Error registering user");
    }
});

maxapi.post("/user/login", (req, res) => {
    try {
        const { username, password } = req.body;
        maxdb.get("SELECT * FROM users WHERE username = ?", [username], async (err, row) => {
            if (error) {
                console.error(error);
                return res.status(500).send("error logging in");
            }
            if (!row) {
                return res.status(400).send("Invalid username or password");
            }
            const isCorrectPassword = (row.password == password);
            if (!isCorrectPassword) {
                return res.status(400).send("Invalid username or password");
            }
            const token = jwt.sign({ username: row.username }, 'secret_key');
            res.status(200).json({token});

        });
    } catch (err) {
        console.log(err);
        console.log("Couldn't log in!");
        res.status(500).send("error logging in");
    }
});