const express = require ('express');
const sqlite3 = require('sqlite3').verbose();
const jwt = require("jsonwebtoken");

const maxdb = new sqlite3.Database('maxaccpi.db');

const jwt_key = "haha wouldn't you like to know github scrapers";

maxdb.serialize(() => {
    maxdb.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT, maxcoins INTEGER)");
    maxdb.run("CREATE TABLE IF NOT EXISTS codes (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE, used BOOLEAN, value INTEGER)");
});

const maxapi = express();
maxapi.use(express.json());

const PORT = process.env.PORT || 19800;

function makeid(length) {
    var result           = '';
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

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
        maxdb.get("SELECT * FROM users WHERE username = (?)", [username], async (error, row) => {
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
            const token = jwt.sign({ username: row.username }, jwt_key);
            res.status(200).json({token});

        });
    } catch (err) {
        console.log(err);
        console.log("Couldn't log in!");
        res.status(500).send("error logging in");
    }
});

maxapi.post("/maxcoin/add", (req, res) => {
    try {
        const { token, amount } = req.body;
        const username = jwt.decode(token, jwt_key).username;
        maxdb.get("SELECT * FROM users WHERE username = (?)", [username], (err, row) => {
            if (err) {
                return res.status(500).send("Error general");
            }
            if (!row) {
                return res.status(400).send("Username not found in MaxDB");
            }
            maxdb.run("UPDATE users SET maxcoins = (?) WHERE username = (?)", [(row.maxcoins + amount), username], function (err) {
                if (err) {
                    return res.status(500).send("shit. on row " + row.id + " \n\n\n\n\n" + err);
                }
                res.status(200).send("Money added?!?!?!?");
            });
        })

    } catch (err) {
        console.log(err);
        console.log("Couldn't add coin!");
        res.status(500).send("Error minting coin");
    }
});

maxapi.post("/maxcoin/code/redeem", (req, res) => {
    try {
        const { token, code } = req.body;
        const username = jwt.decode(token, jwt_key).username;
        maxdb.get("SELECT * FROM users WHERE username = (?)", [username], (err, row2) => {
            if (err) {
                return res.status(500).send("Error general");
            }
            if (!row2) {
                return res.status(400).send("Username not found in MaxDB");
            }

            let code_value = 0;

            maxdb.get("SELECT * FROM codes WHERE code = (?)", [code], (err, row) => {
                if (err) {
                    return res.status(500).send("Error general");
                }
                if (!row) {
                    return res.status(400).send("Code not found.");
                }
                if (row.used == true) {
                    return res.status(501).send("Code already redeemed.");
                }
                code_value = row.value;
                maxdb.run("UPDATE codes SET used = 1 WHERE code = (?)", [code], function (err) {
                    if (err) {
                        return res.status(500).send("shit. on row " + row.id + " \n\n\n\n\n" + err);
                    }
                });
                maxdb.run("UPDATE users SET maxcoins = (?) WHERE username = (?)", [(code_value + row2.maxcoins), username], function (err) {
                    if (err) {
                        return res.status(500).send("shit. on row " + row.id + " \n\n\n\n\n" + err);
                    }
                    res.status(200).send("Code redeemed?!?!");
                });
            });


        })

    } catch (err) {
        console.log(err);
        console.log("Couldn't add coin!");
        res.status(500).send("Error minting coin");
    }
});

maxapi.post("/maxcoin/code/generate", (req, res) => {
    try {
        const { token, amount } = req.body;
        const username = jwt.decode(token, jwt_key).username;
        const code = makeid(16);
        let not_enough_funds = false;
        maxdb.get("SELECT * FROM users WHERE username = (?)", [username], (err, row) => {
            if (err) {
                return res.status(500).send("Error general");
            }
            if (!row) {
                return res.status(400).send("Username not found in MaxDB");
            }
            if (row.maxcoins - amount < 0) {
                return res.status(500).send("Insufficient funds.");
                not_enough_funds = true;
            }
            maxdb.run("UPDATE users SET maxcoins = (?) WHERE username = (?)", [(row.maxcoins - amount), username], function (err) {
                if (err) {
                    return res.status(500).send("shit. on row " + row.id + " \n\n\n\n\n" + err);
                }
            });
            if (!not_enough_funds){
                maxdb.run("INSERT INTO codes (code, used, value) VALUES (?, 0, ?)", [code, amount], function (err) {
                    if (err) {
                        return res.status(500).send("shit. on row " + row.id + " \n\n\n\n\n" + err);
                    }
                    res.status(200).json({ generated_code: code });
                });
            }
        })

    } catch (err) {
        console.log(err);
        console.log("Couldn't generate a code!");
        res.status(500).send("Error creating a code.");
    }
});

maxapi.post("/maxcoin/remove", (req, res) => {
    try {
        const { token, amount } = req.body;
        const username = jwt.decode(token, jwt_key).username;
        maxdb.get("SELECT * FROM users WHERE username = (?)", [username], (err, row) => {
            if (err) {
                return res.status(500).send("Error general");
            }
            if (!row) {
                return res.status(400).send("Username not found in MaxDB");
            }
            maxdb.run("UPDATE users SET maxcoins = (?) WHERE username = (?)", [(row.maxcoins - amount), username], function (err) {
                if (err) {
                    return res.status(500).send("shit. on row " + row.id + " \n\n\n\n\n" + err);
                }
                res.status(200).send("Money removed?!?!?!?");
            });
        })

    } catch (err) {
        console.log(err);
        console.log("Couldn't remove coin!");
        res.status(500).send("Error removing coin");
    }
});

maxapi.post("/maxcoin/check", (req, res) => {
    try {
        const { username } = req.body;
        maxdb.get("SELECT * FROM users WHERE username = (?)", [username], (err, row) => {
            if (err) {
                console.error(err);
                return res.status(500).send("error? dunno m8");
            }
            if (!row) {
                res.status(400).send("Invalid username");
                console.log("#"+username+"#");
                return;
            }
            res.status(200).json({ maxcoins: row.maxcoins });
        });
    } catch (err) {
        console.log(err);
        console.log("Couldn't check!");
        res.status(500).send("Error checking balance");
    }
});