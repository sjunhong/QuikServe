const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const express = require('express');
const cors = require('cors');

const app = express();
app.use(
  cors({
    origin: '*',
  })
);

app.post('/restaurant', async (req, res) => {
  console.log(`post rest body ${req.body}`);
  const name = req.body.name;

  const restDb = admin.firestore().collection('restaurant');
  const newRestDoc = restDb.doc();
  await newRestDoc.set({
    name: name,
  });

  const output = {
    restaurantId: newRestDoc.id,
  };
  console.log(`post rest res ${output}`);
  res.status(200).json(output);
});

app.post('/table', async (req, res) => {
  console.log(`post table body ${req.body}`);
  const restaurantId = req.body.restaurantId;
  const tableName = req.body.tableName;
  const numberOfPeople = req.body.numberOfPeople;

  const tableDb = admin
    .firestore()
    .collection('restaurant')
    .doc(restaurantId)
    .collection('tables');
  const newTableDoc = tableDb.doc();
  await newTableDoc.set({
    table_name: tableName,
    number_of_people: numberOfPeople,
    total_bills: 0,
  });
  const output = {
    table_id: newTableDoc.id,
  };
  console.log(`post table res ${output}`);
  res.status(200).json(output);
});

app.post('/order', async (req, res) => {
  console.log(`post order body ${req.body}`);
  const restaurantId = req.body.restaurantId;
  const tableId = req.body.tableId;

  const orderNumber = req.body.orderNumber;
  const audioIpfsHash = req.body.audioIpfsHash;
  const transcription = req.body.transcription;
  const keyWords = req.body.keyWords;
  const orders = req.body.orders;

  const tableSnap = admin
    .firestore()
    .collection('restaurant')
    .doc(restaurantId)
    .collection('tables')
    .doc(tableId);

  const orderDb = tableSnap.collection('orders');

  let totalBills = (await tableSnap.get()).data().total_bills;
  orders.forEach((order) => {
    totalBills += order.price * order.quantity;
  });
  await tableSnap.update({
    total_bills: totalBills,
  });
  const newOrderDoc = orderDb.doc();

  await newOrderDoc.set({
    order_number: orderNumber,
    audio_ipfs_hash: audioIpfsHash,
    transcription: transcription,
    key_words: keyWords,
    orders: orders,
  });

  const output = {
    order_id: newOrderDoc.id,
  };
  console.log(`post order res ${output}`);
  res.status(200).json(output);
});

app.get('/restaurant/:restaurant_id', async (req, res) => {
  const restaurantId = req.params.restaurant_id;
  const restDoc = admin.firestore().collection('restaurant').doc(restaurantId);
  const restData = (await restDoc.get()).data();
  const restName = restData.name;

  let tables = [];
  const tablesSnap = await restDoc.collection('tables').get();
  console.log(`table snap: ${tablesSnap}, restName: ${restName}`);

  tablesSnap.docs.forEach((doc) => {
    console.log(`snap doc output: ${doc}`);
    const data = doc.data();
    const table = {
      table_name: data.table_name,
      number_of_people: data.number_of_people,
    };
    tables.push(table);
  });

  const output = { name: restName, tables: tables };
  console.log(`get rest res ${JSON.stringify(output, null, 4)}`);
  return res.status(200).json(output);
});

app.get('/table/:restaurant_id/:table_id', async (req, res) => {
  const restaurantId = req.params.restaurant_id;
  const tableId = req.params.table_id;
  const tableDoc = admin
    .firestore()
    .collection('restaurant')
    .doc(restaurantId)
    .collection('tables')
    .doc(tableId);

  const tableData = (await tableDoc.get()).data();
  const tableNumber = tableData.table_number;
  const numberOfPeople = tableData.number_of_people;
  const totalBills = tableData.total_bills;

  let ordersMap = new Map();
  let audioIpfsHash = [];
  const ordersSnap = await tableDoc.collection('orders').get();

  ordersSnap.docs.forEach((doc) => {
    const data = doc.data();
    audioIpfsHash.push(data.audio_ipfs_hash);
    data.orders.forEach((order) => {
      console.log(`order: ${JSON.stringify(order, null, 4)}`);
      const menu = order.menu;
      const quantity = (ordersMap.get(order.quantity) ?? 1) + 1;
      const price = order.price;
      ordersMap.set(order.name, {
        quantity: quantity,
        price: price,
      });
    });
  });

  let orders = [];
  ordersMap.forEach((val, key) => {
    console.log(`val key: ${JSON.stringify(val, null, 4)}, key`);
    const quantity = val.quantity;
    const price = val.price;
    orders.push({
      key,
      quantity,
      price,
    });
  });

  const output = {
    tableNumber: tableNumber,
    numberOfPeople: numberOfPeople,
    totalBills: totalBills,
    orders: orders,
    audioIpfsHash: audioIpfsHash,
  };
  console.log(`get table res ${output}`);
  return res.status(200).json(output);
});

exports.api = functions.https.onRequest(app);
