//@ts-ignore
import TronWeb from "tronweb";
import {
  generateErrorResponse,
  generateSuccessResponse,
} from "../../utils/commonObject";

const initializeTronWeb = async (rpcUrl: string) => {
  const tronWeb = new TronWeb({
    fullHost: rpcUrl,
    headers: {
      "TRON-PRO-API-KEY": process.env.TRONGRID_API_KEY,
    },
  });
  return tronWeb;
};

const createTrxAddress = async (rpcUrl: string) => {
  try {
    const tronWeb = await initializeTronWeb(rpcUrl);
    const response = await tronWeb.createAccount();

    if (response) {
      const data = {
        address: response.address.base58,
        privateKey: response.privateKey,
        publicKey: response.publicKey,
      };

      return generateSuccessResponse("TRC Wallet created successfully", data);
    } else {
      return generateErrorResponse("TRC Wallet not generated");
    }
  } catch (err) {
    console.log(err);
    return generateErrorResponse("Something went wrong");
  }
};

const getTrxBalance = async (rpcUrl: string, address: string) => {
  try {
    const tronWeb = await initializeTronWeb(rpcUrl);
    let balance = await tronWeb.trx.getBalance(address);

    if (balance) {
      balance = parseFloat(tronWeb.fromSun(balance));
      return generateSuccessResponse("Balance get successfully", balance);
    } else {
      return generateErrorResponse("Balance get failed", balance);
    }
  } catch (err) {
    console.log(err);
    return generateErrorResponse("Something went wrong");
  }
};

const sendTrxCoin = async (
  rpcUrl: string,
  toAddress: string,
  amount: number,
  privateKey: string
) => {
  try {
    const tronWeb = await initializeTronWeb(rpcUrl);

    const amountSun = parseInt(tronWeb.toSun(amount));

    const checkAddress = await tronWeb.isAddress(toAddress);

    if (checkAddress) {
      const response = await tronWeb.trx.sendTransaction(
        toAddress,
        amountSun,
        privateKey
      );
      if (response && response.result == true) {
        const data = {
          hash: response.txid,
        };
        return generateSuccessResponse("Send trx success", data);
      } else {
        return generateErrorResponse("Send trx failed");
      }
    } else {
      return generateErrorResponse("Invalid address");
    }
  } catch (err) {
    console.log(err);
    return generateErrorResponse("Something went wrong");
  }
};

const getConfirmedTransaction = async (rpcUrl: string,contractAddress:string, txId:string) => {
  try {
    const tronWeb = await initializeTronWeb(rpcUrl);

    const response = await tronWeb.trx.getTransactionInfo(txId);

    if (response) {
      
      const contract = await tronWeb.contract().at(contractAddress);

        const data = {
            hash: response,
            gas_used: parseFloat(tronWeb.fromSun(response.fee)),
            txID: response.id,
        };
        return generateSuccessResponse("Get transaction success", data);
      
    } else {
        return generateErrorResponse("Get transaction failed");
      
    }
  } catch (err) {
    return generateErrorResponse("Something went wrong");
  }
};
