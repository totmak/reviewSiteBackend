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
  }

  async getOneFrom(querry, proje){
    return this.client.db(this.parent.id).collection(this.id).findOne(querry,proje);
  }

  async getAllFrom(querry, proje){
    return this.client.db(this.parent.id).collection(this.id).find(querry).project(proje).toArray();
  }

  async updateCollection(querry, update){
    this.client.db(this.parent.id).collection(this.id).updateOne(querry,
      { $set: update}
    )
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
    await this.addToCollection("messages", {"groupName": info.group, "message": `New chat room has been created by ${group.participants[info.uID]}`, "user": 0});
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
    const serverMessage = (info.uID != 1)?`${group.participants[info.uID]} has rejoined`:`A visitor has joined`;
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
    console.log("connected to database has been estabalish");
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
    const partUpdate = await dbChat.getCollectionById("groups").getOneFrom( {"name": groupName},{participants: 1} );
    partUpdate.participants[uid] = userName.value;
    await dbChat.getCollectionById("groups").updateCollection({"name": groupName}, {"participants": partUpdate.participants})
  }
}
const estCon = new Connection();
module.exports = { estCon };
