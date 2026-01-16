const express = require("express");
const app = express();
const walletRoutes = require("./routes/wallet");

app.use(express.json());
app.use("/api", walletRoutes);

app.listen(3000, () => console.log("Backend running on port 3000"));
