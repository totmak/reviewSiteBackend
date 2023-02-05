const MongoClient = require('mongodb').MongoClient;
const uri = "mongodb://mongo:BeyDUhUoN0iLegRFPN4L@containers-us-west-130.railway.app:6055"
const randtoken = require('rand-token');

const serverKey = '6aKSdlOzhtzEAt1T'; //TODO replace with server variable

const encryptor = require('simple-encryptor')(serverKey);

function enryptJSON(data){
    Object.entries(data).forEach(([key, value]) => {
      if (key != '_id'){
        data[key] = encryptor.encrypt(value);
      }
    });
    console.log(data);
    return data;
}

function decryptJSON(data){
  Object.entries(data).forEach(([key, value]) => {
    if (key != '_id'){
      data[key] = encryptor.decrypt(data[key]);
    }
  });
  console.log(data);
  return data;
}

function matchQuery(data, query){
  return Object.entries(query).every(([key, value]) => {
    return data[key] == query[key];
  });
}

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
    enryptJSON(addition);
    this.client.db(this.parent.id).collection(this.id).insertOne(addition)
  }

  async getOneFrom(query, proje){
    const cursor = await this.client.db(this.parent.id).collection(this.id).find({}).project(proje);
    let cur = undefined;
    while (await cursor.hasNext()) {
      cur = await cursor.next()
      decryptJSON(cur);
      if (matchQuery(cur, query)){
        break;
      } else { cur = undefined; }
    }
    cursor.close()
    return cur;
    //return this.client.db(this.parent.id).collection(this.id).findOne(query,proje);
  }

  async getList(cursor, query){
    let cur;
    const listQuery = [];
    while (await cursor.hasNext()) {
      cur = await cursor.next()
      decryptJSON(cur);
      if (matchQuery(cur, query)){
        listQuery.push(cur);
      }
    }
    cursor.close()
    return listQuery;
  }

  async getAllFrom(query, proje){
    const cursor = await this.client.db(this.parent.id).collection(this.id).find({}).project(proje);
    const listQuery = await this.getList(cursor, query);
    return listQuery;
  //  return this.client.db(this.parent.id).collection(this.id).find(query).project(proje).toArray();
  }

  async updateOneCollection(query, update){
    const updateEnc = enryptJSON(update);
    const doc = await this.getOneFrom(query,{});
    await this.client.db(this.parent.id).collection(this.id).updateOne(
      {_id: doc._id},
      { $set: updateEnc}
    );
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

  async addToCollection(collectionID, addition){
    if (await this.hasCollectionId(collectionID)){
      await this.getCollectionById(collectionID).addTo(addition);
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
    const uID = (await this.getCollectionById("user_ids").getCount())+1000;
    await this.addToCollection("user_ids", {"value": uID});
    await this.addToCollection("usernames", {"value": info.username, "uID": uID});
    await this.addToCollection("forenames", {"value": info.firstname, "uID": uID});
    await this.addToCollection("surnames", {"value": info.lastname, "uID": uID});
    await this.addToCollection("passwords", {"value": info.password, "uID": uID});
  }

  async findLoginStatus(info, socket){
    const userName = await this.getCollectionById("usernames").getOneFrom(
      {"value": info.username},{_id: 0}
    );
    if (userName == null){
      socket.emit('loginFailNoUsername', userName);
    } else {
      const uID = userName.uID;
      const passCheck = await this.getCollectionById("passwords").getOneFrom(
        { "uID": uID,
          "value": info.password
        }, {})
        if (passCheck){
          socket.emit('loginSuccess', userName);
        } else {
          socket.emit('loginFailWrongPassword', userName);
        }
    }
  }


  /*
    Called from this.handleGroupJoin
  */

  async createNewChatGroup(info){
    await this.addToCollection("groups",
      {"name":info.group,
      "participants":
        { 0: "server", 1: "visitor" }
      }
    );

    if (info.uID != 1){
      await estCon.addParticipantToGroup(info.uID, info.group);
    }
    const group = await this.getCollectionById("groups").getOneFrom(
      {"name": info.group}, {}
    );
    if (group.participants[info.uID] == undefined){
      throw new Error("participant uID does not match")
    }
    const mst = `New chat room has been created by ${group.participants[info.uID]}`;
    await this.addToCollection("messages", {"groupName":info.group, "message": mst, "user": 0});
    return group;
  }

  async firstJoinChatGroup(info,group){
    if (info.uID != 1){
      await estCon.addParticipantToGroup(info.uID, info.group);
    }
    const newGroup = await this.getCollectionById("groups").getOneFrom(
      {"name": info.group}, {}
    );
    await this.addToCollection("messages", {"groupName": info.group, "message": `${newGroup.participants[info.uID]} has joined`, "user": 0});
  }

  async reJoinChatGroup(info,group){
    const serverMessage = (info.uID != 1)?`${group.participants[info.uID]} has rejoined`:`A new visitor has joined`;
    await this.addToCollection("messages", {"groupName": info.group, "message": serverMessage, "user": 0});
  }

  async joinChatGroup(info){
    const group = await this.getCollectionById("groups").getOneFrom(
      {"name": info.group}, {}
    );
    if (group.participants[info.uID] == undefined){
      await this.firstJoinChatGroup(info,group);
    } else {
      await this.reJoinChatGroup(info,group);
    }
    return group;
  }

  /**
  * if group exists, join it, otherwise create a new group
  *
  **/

  async handleGroupJoin(info, socket){
    const group = (await this.getCollectionById("groups").getOneFrom(
      {"name": info.group}, {}) == undefined?await this.createNewChatGroup(info):await this.joinChatGroup(info)
    );
    const groupMessages = await this.getCollectionById("messages").getAllFrom(
      { "groupName": group.name}, {_id: 0})
    socket.emit("updateChatLog", {"messages": groupMessages, "participants": group.participants});
  }

  async handleChatMessage(info, socket){
    const group = await this.getCollectionById("groups").getOneFrom(
      {"name": info.group}, {}
    );
    await this.addToCollection("messages", {"groupName": info.group, "message": info.message, "user": info.user!=null?info.user:1});
    const groupMessages = await this.getCollectionById("messages").getAllFrom(
      { "groupName": group.name}, {_id: 0})
      console.log(groupMessages)
    socket.emit('updateChatLog', {"messages": groupMessages, "participants": group.participants});
  }

}

class Connection {
  constructor(){}
  async estabalish(dblist, socketList){
    this.socketList = socketList;
    this.client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

    await this.client.connect();
    this.databases = dblist.map((item, i) => { return new Database(item, this.client); });
    console.log("connected to database has been estabalished");
    this.socketList.hasDbConnect = true;
    this.socketList.updator();
  }
  getDatabaseById(id){
    return this.databases.find((item, i) => {
      return item.id == id;
    });
  }
  unestabalish(){
    estCon.client.close();
    this.databases.length = 0;
    this.socketList.hasDbConnect = false;
    console.log("disconnected from the database");
  }
  async addParticipantToGroup(uid, groupName){
    const dbUA = await estCon.getDatabaseById("user_accounts");
    const userName = await dbUA.getCollectionById("usernames").getOneFrom(
      {"uID": Number(uid)},{_id: 0}
    )
    const dbChat = await estCon.getDatabaseById("chats");
    const partUpdate = await dbChat.getCollectionById("groups").getOneFrom( {"name": groupName},{name: 1, participants: 1} );

    partUpdate.participants[uid] = userName.value;
    await dbChat.getCollectionById("groups").updateOneCollection({"name":groupName}, {"participants": partUpdate.participants})
  }
}
const estCon = new Connection();
module.exports = { estCon };
