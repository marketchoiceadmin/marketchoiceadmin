// firebase-ops.js

// Import Firebase SDK (make sure you include firebase-app.js, firebase-database.js, and firebase-storage.js in your HTML)

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDwAykagQZBJHSINCFFb6tkn3BzTTtR4f0",
  authDomain: "marketchoice-bad01.firebaseapp.com",
  databaseURL: "https://marketchoice-bad01-default-rtdb.firebaseio.com",
  projectId: "marketchoice-bad01",
  storageBucket: "marketchoice-bad01.appspot.com", // corrected bucket format
  messagingSenderId: "60323903521",
  appId: "1:60323903521:web:3955b48f448f8beae74b60"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const storage = firebase.storage();

// Function to read JSON data
function readData(path, callback) {
  database.ref(path).on("value", function(snapshot) {
    callback(snapshot.val());
  });
}

// Function to write JSON data
function writeData(path, data) {
  database.ref(path).set(data);
}

// Function to update JSON data
function updateData(path, data) {
  database.ref(path).update(data);
}

// Function to save base64 image string in Realtime Database
function saveBase64Image(id, base64String, callback) {
  database.ref("images/" + id).set(base64String, function(error) {
    if (error) {
      console.error("Error saving image:", error);
    } else {
      if (callback) callback();
    }
  });
}

// Function to read base64 image string
function readBase64Image(id, callback) {
  database.ref("images/" + id).once("value").then(snapshot => {
    callback(snapshot.val());
  });
}

window.firebaseOps = {
  readData,
  writeData,
  updateData,
  saveBase64Image,
  readBase64Image
};
