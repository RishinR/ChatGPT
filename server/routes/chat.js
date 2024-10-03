import { Router } from "express";
import dotnet from "dotenv";
import { Configuration, OpenAIApi } from "openai";
import user from "../helpers/user.js";
import jwt from "jsonwebtoken";
import chat from "../helpers/chat.js";

dotnet.config()

const AZURE_OPENAI_API_KEY_EUS = process.env.AZURE_OPENAI_API_KEY_EUS;
const AZURE_OPENAI_KEY_NCUS = process.env.AZURE_OPENAI_KEY_NCUS;
const AZURE_ENDPOINT_EUS = process.env.AZURE_ENDPOINT_EUS;
const AZURE_ENDPOINT_NCUS = process.env.AZURE_ENDPOINT_NCUS;
import { OpenAIClient, AzureKeyCredential } from "@azure/openai";
dotnet.config();
 
let router = Router();
 
const CheckUser = async (req, res, next) => {
  jwt.verify(
    req.cookies?.userToken,
    process.env.JWT_PRIVATE_KEY,
    async (err, decoded) => {
      if (decoded) {
        let userData = null;
 
        try {
          userData = await user.checkUserFound(decoded);
        } catch (err) {
          if (err?.notExists) {
            res.clearCookie("userToken").status(405).json({
              status: 405,
              message: err?.text,
            });
          } else {
            res.status(500).json({
              status: 500,
              message: err,
            });
          }
        } finally {
          if (userData) {
            req.body.userId = userData._id;
            next();
          }
        }
      } else {
        res.status(405).json({
          status: 405,
          message: "Not Logged",
        });
      }
    }
  );
};
 
const configuration = new Configuration({
  organization: process.env.OPENAI_ORGANIZATION,
  apiKey: process.env.OPENAI_API_KEY,
});
 
const openai = new OpenAIApi(configuration);
async function sendPromptNew(prompt) {
  const messages = [{ role: "user", content: prompt }];
  const client = new OpenAIClient(
    AZURE_ENDPOINT_EUS,
    new AzureKeyCredential(AZURE_OPENAI_API_KEY_EUS)
  );
  try {
    const deploymentId = "BT-OpenAIGPT4";
    const response = await client.getChatCompletions(deploymentId, messages);
    return response.choices[0].message.content;
  } catch (error) {
    console.error("Error sending prompt to OpenAI:", error);
    throw error;
  }
}
 
router.get("/", (req, res) => {
  res.send("Welcome to chatGPT api v1");
});
 
router.post("/", CheckUser, async (req, res) => {
  const { prompt, userId} = req.body;
  console.log(prompt, userId)
 
  let response = {};
  try {
    response.openai = await sendPromptNew(prompt);
    console.log(response)
    response.db = await chat.newResponse(prompt, response, userId);
    console.log(response)
  } catch (err) {
    console.log("error", err)
    res.status(500).json({
      status: 500,
      message: err,
    });
  } finally {
    console.log("in finally", response)
    if (response?.db && response?.openai) {
      res.status(200).json({
        status: 200,
        message: "Success",
        data: {
          _id: response.db["chatId"],
          content: response.openai,
        },
      });
    }
  }
});
 
router.put("/", CheckUser, async (req, res) => {
  const { prompt, userId, chatId } = req.body;
 
  let response = {};
  try {
    response.openai = await sendPromptNew(prompt);
    console.log(response)
    response.db = await chat.updateChat(chatId, prompt, response, userId);
  } catch (err) {
    res.status(500).json({
      status: 500,
      message: err,
    });
  } finally {
    if (response?.db && response?.openai) {
      res.status(200).json({
        status: 200,
        message: "Success",
        data: {
          content: response.openai,
        },
      });
    }
  }
});
 
router.get("/saved", CheckUser, async (req, res) => {
  const { userId } = req.body;
  const { chatId = null } = req.query;
 
  let response = null;
 
  try {
    response = await chat.getChat(userId, chatId);
  } catch (err) {
    if (err?.status === 404) {
      res.status(404).json({
        status: 404,
        message: "Not found",
      });
    } else {
      res.status(500).json({
        status: 500,
        message: err,
      });
    }
  } finally {
    if (response) {
      res.status(200).json({
        status: 200,
        message: "Success",
        data: response,
      });
    }
  }
});
 
router.get("/history", CheckUser, async (req, res) => {
  const { userId } = req.body;
 
  let response = null;
 
  try {
    response = await chat.getHistory(userId);
  } catch (err) {
    res.status(500).json({
      status: 500,
      message: err,
    });
  } finally {
    if (response) {
      res.status(200).json({
        status: 200,
        message: "Success",
        data: response,
      });
    }
  }
});
 
router.delete("/all", CheckUser, async (req, res) => {
  const { userId } = req.body;
 
  let response = null;
 
  try {
    response = await chat.deleteAllChat(userId);
  } catch (err) {
    res.status(500).json({
      status: 500,
      message: err,
    });
  } finally {
    if (response) {
      res.status(200).json({
        status: 200,
        message: "Success",
      });
    }
  }
});
 
export default router;