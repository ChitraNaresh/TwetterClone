const express = require("express");
const path = require("path");
const format = require("date-fns/format");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "twitterClone.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

//API 1

app.post("/register", async (request, response) => {
  let { name, username, password, gender } = request.body; //Destructuring the data from the API call

  let hashedPassword = await bcrypt.hash(password, 10); //Hashing the given password
  let checkTheUsername = `
            SELECT *
            FROM user
            WHERE username = '${username}';`;
  let userData = await db.get(checkTheUsername); //Getting the user details from the database
  if (userData === undefined) {
    //checks the condition if user is already registered or not in the database
    /*If userData is not present in the database then this condition executes*/
    let postNewUserQuery = `
            INSERT INTO
            user (name,username,password,gender)
            VALUES (
                '${name}',
                '${username}',
                '${password}',
                '${gender}'
            );`;
    if (password.length < 5) {
      //checking the length of the password
      response.status(400);
      response.send("Password is too short");
    } else {
      /*If password length is greater than 5 then this block will execute*/

      let newUserDetails = await db.run(postNewUserQuery); //Updating data to the database
      response.status(200);
      response.send("User created successfully");
    }
  } else {
    /*If the userData is already registered in the database then this block will execute*/
    response.status(400);
    response.send("User already exists");
  }
});

//API 2

app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//API 3

app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const userQuery = `SELECT * FROM user WHERE username="${request.username}"`;
  const userDetails = await db.get(userQuery);
  const { username } = request;
  const userTweets = `
        SELECT user.username as username,
        tweet.tweet as tweet,
        tweet.date_time as dateTime
        FROM follower INNER JOIN tweet ON follower.following_user_id = tweet.user_id INNER JOIN user ON user.user_id=follower.following_user_id
        WHERE follower.follower_user_id=${userDetails.user_id}
        ORDER BY date_time DESC
        LIMIT 4
    `;
  const getArray = await db.all(userTweets);
  response.send(getArray);
});

//API 4

app.get("/user/following/", authenticateToken, async (request, response) => {
  const { username } = request;
  const userQuery = `SELECT *
          FROM user
          WHERE username="${username}"`;
  const userIdValue = await db.get(userQuery);
  console.log(userIdValue);
  const userValue = `SELECT name
          FROM user INNER JOIN follower ON user.user_id=follower.following_user_id 
          WHERE follower.follower_user_id=${userIdValue.user_id}`;

  const getArray = await db.all(userValue);
  response.send(getArray);
});

//API 5

app.get("/user/followers/", authenticateToken, async (request, response) => {
  const { username } = request;
  const userQuery = `SELECT *
          FROM user
          WHERE username="${username}"`;
  const userIdValue = await db.get(userQuery);
  console.log(userIdValue);
  const userValue = `SELECT name
          FROM user INNER JOIN follower ON user.user_id=follower.follower_user_id
          WHERE follower.following_user_id=${userIdValue.user_id}`;

  const getArray = await db.all(userValue);
  response.send(getArray);
});

//API 7

app.get(
  "tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    console.log(32);
    const { username } = request;
    const { tweetId } = request.params;
    const userQuery = `SELECT *
          FROM user
          WHERE username="${username}"`;
    const userIdValue = await db.get(userQuery);
    console.log(userIdValue);
    const userValue = `SELECT username
          FROM follower INNER JOIN tweet ON tweet.user_id=follower.following_user_id
          INNER JOIN like ON like.tweet_id=tweet.tweet_id INNER JOIN user ON user.user_id=like.user_id
          WHERE follower.follower_user_id=${userIdValue.user_id} AND
          tweet.tweet_id=${tweetId}`;

    const getArray = await db.all(userValue);
    console.log(getArray);
    response.send(getArray);
    if (getArray.length) {
      console.log(11);
      let likeUsers = [];
      for (let item of getArray) {
        likeUsers.push(item["name"]);
      }
      console.log(likeUsers);
      response.send(likeUsers);
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
    response.send(tweetId);
    console.log(32);
  }
);

//API 8

app.get(
  "tweets/:tweetId/replies",
  authenticateToken,
  async (request, response) => {
    console.log(32);
    const { username } = request;
    const { tweetId } = request.params;
    const userQuery = `SELECT *
          FROM user
          WHERE username="${username}"`;
    const userIdValue = await db.get(userQuery);
    console.log(userIdValue);
    const userValue = `SELECT *
          FROM follower INNER JOIN tweet ON tweet.user_id=follower.following_user_id 
          INNER JOIN reply ON reply.tweet_id=tweet.tweet_id INNER JOIN user ON user.user_id=reply.user_id
          WHERE follower.follower_user_id=${userIdValue.user_id} AND 
          tweet.tweet_id=${tweetId}`;

    const getArray = await db.all(userValue);
    console.log(getArray);
    response.send(getArray);
    if (getArray.length) {
      console.log(11);
      let likeUsers = [];
      for (let item of getArray) {
        likeUsers.push(item["name"]);
      }
      console.log(likeUsers);
      response.send(likeUsers);
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
    console.log(32);
  }
);

//API 6

app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const { username } = request;
  const { tweetId } = request.params;
  const userQuery = `SELECT *
          FROM user
          WHERE username="${username}"`;
  const userIdValue = await db.get(userQuery);
  console.log(userIdValue);
  const userValue = `SELECT *
           FROM follower INNER JOIN user ON follower.following_user_id=user.user_id
            WHERE follower.follower_user_id=${userIdValue.user_id}`;
  const followingUsers = await db.all(userValue);

  const specificTweet = `SELECT * FROM tweet WHERE tweet.tweet_id=${tweetId}`;
  const tweetResult = await db.get(specificTweet);

  if (
    followingUsers.some(
      (item) => item.following_user_id === tweetResult.user_id
    )
  ) {
    const checkQuery = `
      SELECT tweet,
      COUNT(DISTINCT(like.like_id)) AS replies,
       COUNT(DISTINCT(reply.reply_id)) AS likes,
       tweet.date_time AS dateTime
      FROM tweet
      INNER JOIN like ON  tweet.tweet_id= like.tweet_id INNER JOIN reply ON tweet.tweet_id= reply.tweet_id
      WHERE tweet.tweet_id = ${tweetId};
    `;
    const getTweetValue = await db.get(checkQuery);
    response.send(getTweetValue);
  } else {
    response.status(401);
    response.send("Invalid Request");
  }

  console.log(32);
  const getArrayVal = await db.get(checkQuery);
  const tweetQuery = `
          SELECT tw.tweet, COUNT(l.like_id) as likes, COUNT(r.reply_id) as replies, tw.date_time as dateTime
          FROM tweet tw
          LEFT JOIN like l ON tw.tweet_id = l.tweet_id
          LEFT JOIN reply r ON tw.tweet_id = r.tweet_id
          WHERE tw.tweet_id = ${request.params.todoId}
        `;
  const getArray = await db.get(tweetQuery);
  response.send(getArray);
});

//API 9

app.get("/user/tweets/", authenticateToken, async (request, response) => {
  const { username } = request;
  const userQuery = `SELECT *
          FROM user
          WHERE username="${username}"`;
  const userIdValue = await db.get(userQuery);
  console.log(userIdValue);
  const userValue = `SELECT tweet.tweet AS tweet,
          COUNT(DISTINCT(like.like_id)) AS likes,
          COUNT(DISTINCT(reply.reply_id)) AS replies,
          tweet.date_time AS dateTime
          FROM user INNER JOIN tweet ON user.user_id=tweet.user_id INNER JOIN
          like ON like.tweet_id=tweet.tweet_id INNER JOIN
          reply ON reply.tweet_id = tweet.tweet_id
          WHERE user.user_id=${userIdValue.user_id}
          GROUP BY tweet.tweet_id`;

  const getArray = await db.all(userValue);
  response.send(getArray);
});

//API 10

app.post("/user/tweets/", authenticateToken, async (request, response) => {
  const { username } = request;
  const { tweet } = request.body;
  console.log(tweet);
  const userQuery = `SELECT *
          FROM user
          WHERE username="${username}"`;
  const userIdValue = await db.get(userQuery);
  console.log(userIdValue);
  const insertQuery = `
      INSERT INTO tweet (tweet,user_id)
      VALUES ("${tweet}",${userQuery.user_id})
  `;
  await db.run(insertQuery);
  response.send("Created a Tweet");
});

//API 11

app.delete("/tweets/:tweetId", authenticateToken, async (request, response) => {
  const { username } = request;
  const { tweetId } = request.tweetId;
  console.log(tweet);
  const userQuery = `SELECT *
          FROM user
          WHERE username="${username}"`;
  const userIdValue = await db.get(userQuery);
  const getUserTweet = `SELECT * FROM tweet WHERE tweet.tweet_id=${tweetId} AND tweet.user_id="${userQuery.user_id}`;
  const tweetsOfUser = await db.run(getUserTweet);
  console.log(userIdValue);
  if (tweetsOfUser.length > 0) {
    const deleteQuery = `
      DELETE FROM tweet WHERE tweet.tweet_id=${tweetId} AND tweet.user_id="${userQuery.user_id}
  `;
    await db.run(insertQuery);
    response.send("Tweet Removed");
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

module.exports = app;
