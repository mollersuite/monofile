import { Router } from "express";
import Files from "../../../lib/files";

let router = Router()

module.exports = function(files: Files) {

    router.get("/", function(req,res) {
        res.send("hello world!")
    })

    return router
}