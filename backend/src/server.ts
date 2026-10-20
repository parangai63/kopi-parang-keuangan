import dotenv from "dotenv";
dotenv.config();

import app from "./app";

// Port default 4100 supaya tidak bentrok dengan backend Parang-ops (4000) saat dev bersamaan.
const PORT = process.env.PORT ? Number(process.env.PORT) : 4100;

app.listen(PORT, () => {
  console.log(`Kopi Parang Keuangan backend running on http://localhost:${PORT}`);
});
