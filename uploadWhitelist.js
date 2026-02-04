/*
  Usage:
  1) npm i firebase-admin
  2) Place serviceAccountKey.json in the project root (or set GOOGLE_APPLICATION_CREDENTIALS)
  3) node uploadWhitelist.js
*/

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  ? process.env.GOOGLE_APPLICATION_CREDENTIALS
  : path.resolve(__dirname, "serviceAccountKey.json");

const dataPath = path.resolve(__dirname, "data.json");

function loadJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`No se pudo leer JSON en ${filePath}: ${err.message}`);
  }
}

async function main() {
  try {
    if (!fs.existsSync(serviceAccountPath)) {
      throw new Error(
        `No se encontró el archivo de credenciales en ${serviceAccountPath}`
      );
    }

    const serviceAccount = require(serviceAccountPath);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    const db = admin.firestore();

    const data = loadJson(dataPath);

    if (!data || !Array.isArray(data.users)) {
      throw new Error("El JSON debe contener un array 'users'.");
    }

    const batch = db.batch();
    let count = 0;

    for (const user of data.users) {
      if (!user.email) {
        throw new Error("Cada usuario debe tener el campo 'email'.");
      }

      const docRef = db.collection("whitelist").doc(user.email);
      batch.set(docRef, {
        nombre: user.nombre || "",
        rol: user.rol || "",
        activo: Boolean(user.activo),
        email: user.email,
      });

      count += 1;
    }

    await batch.commit();
    console.log(`OK: Se subieron ${count} usuarios a 'whitelist'.`);
    process.exit(0);
  } catch (err) {
    console.error(`ERROR: ${err.message}`);
    process.exit(1);
  }
}

main();
