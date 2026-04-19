import { defineApp } from "convex/server";
import migrations from "@convex-dev/migrations/convex.config";
import cloudinary from "@imaxis/cloudinary-convex/convex.config";
import resend from "@convex-dev/resend/convex.config.js";

const app = defineApp();
app.use(migrations);
app.use(cloudinary);
app.use(resend);

export default app;
