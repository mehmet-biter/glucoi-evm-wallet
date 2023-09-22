import { PrismaClient } from "@prisma/client";
import { generateErrorResponse } from "../../utils/commonObject";

const prisma = new PrismaClient();

const checkDeposit = async() => {
    try {
        const networks = await prisma.$queryRaw`
        SELECT * 
        FROM networks 
        JOIN notified_blocks ON networks.id = notified_blocks.network_id
        JOIN supported_networks supported_networks.slug = networks.slug
        WHERE networks.status = 1;`
    } catch (err:any) {
        console.log('checkDeposit',err);
        return generateErrorResponse(err.stack)
    }
}