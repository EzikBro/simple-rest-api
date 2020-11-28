const express = require("express");
const bodyParser = require("body-parser");
const MongoClient = require("mongodb").MongoClient;
const objectId = require("mongodb").ObjectID;


const app = express();
const jsonParser = bodyParser.json();
const mongoClient = new MongoClient("mongodb://localhost:27017/", { useNewUrlParser: true, useUnifiedTopology: true });


const home_url = "http://localhost:3000/";
let count;

// логирование запросов
app.use(function(req, res, next){
    console.log(`\n${new Date().toTimeString()}: ${req.method}`);
    next();
});

let dbClient;
mongoClient.connect(async function(err, client){
    if(err)
        return console.log(err);

    dbClient = client;
    app.locals.collection = client.db("shortener").collection("urls");

    count = await client.db("shortener").collection("urls").countDocuments();

    app.listen(3000, function(){
        console.log(`${new Date().toTimeString()}: Сервер запущен`);
        console.log(`На момент запуска в urls ${count} документов`);
    });
});

function toUrl(n) {
    const alphabet = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    let r = ['', '', '', '', '', '', '', ''];
    for (let i = 0; i < r.length; i++) {
        r[i] = alphabet[n % alphabet.length];
        n = parseInt(n / alphabet.length);
    }
    return r.join('');
}

// сокращение ссылки
app.post("/shorten", jsonParser, function (req,res) {
    if (!req.body)
        return res.sendStatus(400);

    let long_url = req.body.urlToShorten;
    let short_url = `${toUrl(++count)}`;
    let element = {short: short_url, long: long_url, views: 0};

    console.log(`SHORTEN ${long_url} TO ${short_url}`);

    const collection = req.app.locals.collection;
    collection.insertOne(element, function(err, result){
        if(err)
            res.sendStatus(400);
        else
        {
            let answer = {"status": "Created",
                          "shortenedUrl": home_url + short_url};
            res.status(201).send(answer);
        }
    });
})

/*
// отправление БД
app.get("/database", function (req, res){
    const collection = req.app.locals.collection;
    collection.find({}).toArray(function(err, urls){
        if(err)
            res.sendStatus(404);
        else
            res.send(urls)
    });
})
*/

// перенаправление
app.get("/:url", function(req, res) {
    let short_url = req.params.url;

    const collection = req.app.locals.collection;
    collection.findOneAndUpdate({short: short_url}, {$inc: {views: 1}}, {}, function (err, result) {
        if (err || !result.value)
            res.sendStatus(404);
        else {
            console.log(`REDIRECT FROM ${result.value.short} TO ${result.value.long}`);
            res.redirect(301, result.value.long);
        }
    });
})

// количество переходов по ссылке
app.get("/:url/views", function (req, res) {
    let short_url = req.params.url;

    const collection = req.app.locals.collection;
    collection.findOne({short: short_url}, function(err, result){
        if(err || !result)
            res.sendStatus(404);
        else {
            console.log(`LINK'S ${result.short} VIEWS COUNT: ${result.views}`);
            let answer = {"viewCount": result.views};
            res.send(answer);
        }
    });
})

// прослушиваем прерывание работы программы (ctrl-c)
process.on("SIGINT", () => {
    dbClient.close();
    process.exit();
});