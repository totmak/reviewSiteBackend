const MongoClient = require('mongodb').MongoClient;
const uri = "mongodb://mongo:BeyDUhUoN0iLegRFPN4L@containers-us-west-130.railway.app:6055"

class Collection {
  constructor(parent, id, client){
    this.id = id;
    this.parent = parent;
    this.client = client;
  }

  async getCount(){
    const some = await this.client.db(this.parent.id).collection(this.id).count();
    return some;
  }

  async addTo(addition){

    await this.client.db(this.parent.id).collection(this.id).insertOne(addition)

/*
    await this.client.db(this.parent.id).collection(this.id).insertOne({name:"xaz0"});
    console.log("aad");*/
  }

  async getFrom(querry){
    return this.client.db(this.parent.id).collection(this.id).findOne(querry, {});
  }
}


class Database {
  /**
  *  @param {JSON Object} raw - from {databaseList} index.js
  *  @param {Connection} client - from {Connection}
  */
  constructor(raw, client){
    this.id = raw.id;
    this.client = client;
    this.collections = raw.collections.map((item, i) => {
      return new Collection(this, item, client);
    });
  }

  hasCollectionId(id){
    return this.getCollectionById(id) != undefined;
  }

  addToCollect(collectionID, addition){
    if (this.hasCollectionId(collectionID)){
      this.getCollectionById(collectionID).addTo(addition);
    }
  }

  getCollectionById(id){
    return this.collections.find((item, i) => {
      return item.id == id;
    });
  }
  listDatabases(){
      databasesList = this.client.db().admin().listDatabases();
      databasesList.databases.forEach(db => console.log(` - ${db.name}`));
  };

   async registerAccount(info){
    const uID = await this.getCollectionById("user_ids").getCount();
    this.addToCollect("user_ids", {"value": uID});
    this.addToCollect("usernames", {"value": info.username, "uID": uID});
    this.addToCollect("forenames", {"value": info.firstname, "uID": uID});
    this.addToCollect("surnames", {"value": info.lastname, "uID": uID});
    this.addToCollect("passwords", {"value": info.password, "uID": uID});
  }

  async findLoginStatus(info, socket){
    const userName = await this.getCollectionById("usernames").getFrom(
      {"value": info.username}
    );
    if (userName == null){
      socket.emit('loginFailNoUsername', userName);
    } else {
      const uID = userName.uID;
      const passCheck = await this.getCollectionById("passwords").getFrom(
        { "uID": uID,
          "value": info.password
        })
        if (passCheck){
          socket.emit('loginSuccess', userName);
        } else {
          socket.emit('loginFailWrongPassword', userName);
        }
    }
  }
}

class Connection {
  constructor(){}
  async estabalish(dblist){
    this.client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

    await this.client.connect();
    this.databases = dblist.map((item, i) => { return new Database(item, this.client); });
    console.log("connected");
  }
  getDatabaseById(id){
    return this.databases.find((item, i) => {
      return item.id == id;
    });
  }
  unestabalish(){
    estCon.client.close();
    this.databases.length = 0;
    console.log("disconnected from the database");
  }
}
const estCon = new Connection();
module.exports = { estCon };




/*
async function somele() {
  try {
      await client.connect();
      const uId = await Collection.getCount(client, "user_accounts", "usernames");

      await Collection.addTo(client, "user_accounts", "user_ids", {uID: uId});

      await Collection.addTo(client, "user_accounts", "usernames", {name: "testName", "uID": uId});
      await Collection.addTo(client, "user_accounts", "passwords", {password: "testPassword", "uID": uId});
      const geto = await Collection.getFrom(client, "user_accounts", "passwords", {"uID": uId});
      console.log(geto);
  } catch (e) {
      console.error(e);
  } finally {
    await client.close();
  }
}*/
