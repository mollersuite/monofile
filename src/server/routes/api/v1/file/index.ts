import { Hono } from "hono";
import Files from "../../../../lib/files.js";
import { getAccount } from "../../../../lib/middleware.js";

const router = new Hono()
router.all("*", getAccount)

export default function(files: Files) {

    

    return router
}
