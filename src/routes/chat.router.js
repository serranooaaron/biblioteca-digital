import { Router } from 'express'

const router = Router()



router.get('/', (req, res) => {
    res.send({ status: "API en desarrolo - proximamente estara habilitada al publico" })
})

export default router;