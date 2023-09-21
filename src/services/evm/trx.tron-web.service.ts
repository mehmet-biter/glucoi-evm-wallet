//@ts-ignore
import TronWeb from "tronweb";
//@ts-ignore
import TronGrid from "trongrid";
import axios from "axios";
import {
  generateErrorResponse,
  generateSuccessResponse,
} from "../../utils/commonObject";
import { powerOfTen } from "../../utils/helper";

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

const getConfirmedTransaction = async (
  rpcUrl: string,
  contractAddress: string,
  txId: string
) => {
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

const getTornWebTransactionListByContractAddress = async (
  rpcUrl: string,
  contractAddress: string,
  adminAddress: string,
  lastTimeStamp: number
) => {
  try {
    const tronWeb = await initializeTronWeb(rpcUrl);

    const limit = 200;

    tronWeb.setAddress(adminAddress);
    const contract = await tronWeb.contract().at(contractAddress);

    const decimal = await contract.decimals().call();
    const getDecimal = powerOfTen(decimal);

    const tronGrid = new TronGrid(tronWeb);

    if (lastTimeStamp == 0) {
      var latestTransaction = await tronGrid.contract.getEvents(
        contractAddress,
        {
          only_confirmed: true,
          event_name: "Transfer",
          limit: limit,
          order_by: "timestamp,desc",
        }
      );

      lastTimeStamp = latestTransaction.data[0].block_timestamp;
    }

    var result = await tronGrid.contract.getEvents(contractAddress, {
      only_confirmed: true,
      event_name: "Transfer",
      limit: limit,
      order_by: "timestamp,asc",
      min_block_timestamp: lastTimeStamp,
    });

    let transactionData: any = [];
    if (result.data.length > 0) {
      result.data.map((tx: any) => {
        tx.from_address = tronWeb.address.fromHex(tx.result.from); // this makes it easy for me to check the address at the other end
        tx.to_address = tronWeb.address.fromHex(tx.result.to); // this makes it easy for me to check the address at the other end
        tx.amount = tx.result.value / getDecimal;
        tx.event = tx.event_name;
        tx.tx_hash = tx.transaction_id;
        transactionData.push(tx);
      });
    }

    const nextLink = result.meta.links?.next;

    if (result.meta.links) {
      transactionData = await hitNextLink(
        contractAddress,
        tronGrid,
        tronWeb,
        nextLink,
        transactionData,
        getDecimal,
        limit,
        lastTimeStamp
      );
    }
    const data = {
      result: transactionData,
    };
    return generateSuccessResponse("Get TRC20 token transactions", data);
  } catch (err) {
    return generateErrorResponse("Something went wrong");
  }
};

async function hitNextLink(
  contractAddress: string,
  tronGrid: any,
  tronWeb: any,
  nextLink: any,
  transactionData: any,
  getDecimal: number,
  limit: number,
  lastTimeStamp: number
) {
  try {
    var response;
    let recursiveStatus = true;

    if (limit >= 1000) {
      limit = 200;
      response = await tornGridApiCall(
        contractAddress,
        tronGrid,
        tronWeb,
        transactionData,
        lastTimeStamp,
        getDecimal,
        limit
      );

      transactionData = response.transactionData;
      nextLink = response.nextLink;
    } else {
      response = await axiosApiCall(
        tronWeb,
        nextLink,
        transactionData,
        getDecimal,
        recursiveStatus
      );

      limit += 200;

      transactionData = response.transactionData;
      nextLink = response.nextLink;
      recursiveStatus = response.recursiveStatus;
      lastTimeStamp = response.lastTimeStamp;
    }

    if (recursiveStatus == true) {
      await hitNextLink(
        contractAddress,
        tronGrid,
        tronWeb,
        nextLink,
        transactionData,
        getDecimal,
        limit,
        lastTimeStamp
      ); // Recursively call hitNextLink with the next link
    }

    return transactionData;
  } catch (error) {
    console.error("An error occurred:", error);
  }
}

async function tornGridApiCall(
  contractAddress: string,
  tronGrid: any,
  tronWeb: any,
  transactionData: any,
  lastTimeStamp: number,
  getDecimal: number,
  limit: number
) {
  var result = await tronGrid.contract.getEvents(contractAddress, {
    only_confirmed: true,
    event_name: "Transfer",
    limit: limit,
    order_by: "timestamp,asc",
    min_block_timestamp: lastTimeStamp,
  });
  if (result.data.length > 0) {
    result.data.map((tx: any) => {
      tx.from_address = tronWeb.address.fromHex(tx.result.from); // this makes it easy for me to check the address at the other end
      tx.to_address = tronWeb.address.fromHex(tx.result.to); // this makes it easy for me to check the address at the other end
      tx.amount = tx.result.value / getDecimal;
      tx.event = tx.event_name;
      tx.tx_hash = tx.transaction_id;
      transactionData.push(tx);
    });
  }

  const nextLink = result.meta.links.next;

  return { transactionData, nextLink };
}

async function axiosApiCall(
  tronWeb: any,
  nextLink: any,
  transactionData: any,
  getDecimal: number,
  recursiveStatus: boolean
) {
  const response = await axios.get(nextLink);
  const result = response.data;
  var lastTimeStamp;

  if (result.data.length > 0) {
    for (let i = 0; i < result.data.length; i++) {
      result.data[i].from_address = tronWeb.address.fromHex(
        result.data[i].result.from
      ); // this makes it easy for me to check the address at the other end
      result.data[i].to_address = tronWeb.address.fromHex(
        result.data[i].result.to
      ); // this makes it easy for me to check the address at the other end
      result.data[i].amount = result.data[i].result.value / getDecimal;
      result.data[i].event = result.data[i].event_name;
      result.data[i].tx_hash = result.data[i].transaction_id;
      transactionData.push(result.data[i]);

      lastTimeStamp = result.data[i].block_timestamp;
    }
  }

  recursiveStatus = result.meta.links ? true : false;

  nextLink = result.meta.links?.next;

  return { transactionData, nextLink, recursiveStatus, lastTimeStamp };
}

const getTrxAddressByPk = async (rpcUrl: string, privateKey: string) => {
  try {
    const tronWeb = await initializeTronWeb(rpcUrl);

    if (privateKey) {
      const response = await tronWeb.address.fromPrivateKey(privateKey);

      if (response) {
        const data = {
          address: response,
        };
        return generateSuccessResponse("TRC data get successfully", data);
      } else {
        return generateErrorResponse("Data get failed");
      }
    } else {
      return generateErrorResponse("Pk is required");
    }
  } catch (error) {
    console.error("An error occurred:", error);
    return generateErrorResponse("Something went wrong");
  }
};

const getTrxAccount = async (rpcUrl: string, address: string) => {
  try {
    const tronWeb = await initializeTronWeb(rpcUrl);

    if (address) {
      const response = await tronWeb.trx.getAccount(address);

      if (response) {
        return generateSuccessResponse("TRC data get successfully");
      } else {
        return generateErrorResponse("Data get failed");
      }
    } else {
      return generateErrorResponse("Address is required");
    }
  } catch (error) {
    return generateErrorResponse("Something went wrong");
  }
};

const checkTrxAddress = async (rpcUrl: string, address: string) => {
  try {
    const tronWeb = await initializeTronWeb(rpcUrl);

    if (address) {
      const response = await tronWeb.isAddress(address);
      if (response) {
        return generateSuccessResponse("Address valid", response);
      } else {
        return generateErrorResponse("Address not found");
      }
    } else {
      return generateErrorResponse("Address is required");
    }
  } catch (error) {
    return generateErrorResponse("Something went wrong");
  }
};

const getTrxConfirmedTransaction = async (
  rpcUrl: string,
  txId: string,
  contractAddress: string
) => {
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
  } catch (error) {
    return generateErrorResponse("Something went wrong");
  }
};

const getTrc20TransferEvent = async (
  rpcUrl: string,
  contractAddress: string,
  adminAddress: string
) => {
  try {
    const tronWeb = await initializeTronWeb(rpcUrl);
    tronWeb.setAddress(adminAddress);

    const contract = await tronWeb.contract().at(contractAddress);

    const decimal = await contract.decimals().call();
    const getDecimal = powerOfTen(decimal);

    contract.Transfer().watch((err: any, event: any) => {
      if (err)
        return console.error(`USDT Transfer event error: ${err.toString()}`);

      if (event) {
        event.result.to = tronWeb.address.fromHex(event.result.to);
        event.result.from = tronWeb.address.fromHex(event.result.from);

        event.result.value = event.result.value / getDecimal;
        console.log(event);

        return generateSuccessResponse("success", event);
      }
    });
  } catch (error) {
    return generateErrorResponse("Something went wrong");
  }
};

const getTrxTransactionBlock = async (
  rpcUrl: string,
  txId: string | null = "trx_hash"
) => {
  try {
    const tronWeb = await initializeTronWeb(rpcUrl);

    const response = await tronWeb.getEventByTransactionID(txId);

    if (typeof response == "object" && response.length > 0) {
      let transaction = response[0];
      let from = transaction.result.from;
      let to = transaction.result.to;
      transaction.result.from = tronWeb.address.fromHex(
        tronWeb.address.toHex(from)
      );
      transaction.result.to = tronWeb.address.fromHex(
        tronWeb.address.toHex(to)
      );

      return generateSuccessResponse(
        "Transaction details get successfully",
        transaction
      );
    } else {
      return generateErrorResponse("Transaction details not found");
    }
  } catch (error) {
    return generateErrorResponse("Something went wrong");
  }
};

const getTrxEstimateGas = async (
  rpcUrl: string,
  ownerWallet: string,
  receiverWallet: string,
  contractAddress: string,
  amount: number,
  perTrx: any
) => {
  try {
    const tronWeb = await initializeTronWeb(rpcUrl);

    const _function = "transfer(address,uint256)";
    const options = {
      feeLimit: 1_000_000,
      callValue: 0,
    };
    const parameter = [
      {
        name: "recipient",
        type: "address",
        value: receiverWallet,
      },
      {
        name: "amount",
        type: "uint256",
        value: amount,
      },
    ];
    const response = await tronWeb.transactionBuilder.triggerConstantContract(
      contractAddress,
      _function,
      options,
      parameter,
      ownerWallet
    );

    if (typeof response == "object" && response.result.result) {
      let energy = response.energy_used;
      let gas = (energy * perTrx) / 1000000;

      const data = {
        gas: gas,
        energy: energy,
      };
      return generateSuccessResponse("Estimted energy found successfully");
    } else {
      return generateErrorResponse("Estimted energy not found");
    }
  } catch (error) {
    return generateErrorResponse("Something went wrong");
  }
};
