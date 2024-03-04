import { Hono } from "hono";
import Files from "../../../lib/files.js";

const router = new Hono()

export default function(files: Files) {
    return router
}
