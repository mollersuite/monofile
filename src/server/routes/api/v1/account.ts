import { Router } from "express";
import Files from "../../../lib/files";

import { getAccount } from "../../../lib/middleware";

let router = Router()

router.use(getAccount)

module.exports = function(files: Files) {
    return router
}