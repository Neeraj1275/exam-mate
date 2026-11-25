import "dotenv/config";
import app from "./api/index";
app.listen(3001, () => console.log("API on http://localhost:3001"));
