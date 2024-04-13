const AWS = require("aws-sdk");
const { Pinecone } = require("@pinecone-database/pinecone");
const { PineconeStore } = require("@langchain/pinecone");
const {
  BedrockEmbeddings,
} = require("@langchain/community/embeddings/bedrock");
const { RunnableSequence } = require("@langchain/core/runnables");
const { formatDocumentsAsString } = require("langchain/util/document");
const { StringOutputParser } = require("@langchain/core/output_parsers");
const { PromptTemplate } = require("@langchain/core/prompts");
const { BedrockChat } = require("@langchain/community/chat_models/bedrock");
const {
  formatError,
  formatResponse,
  parseBody,
  validateAccess,
} = require("./request-helpers");

const secretsManager = new AWS.SecretsManager({
  region: "us-east-1",
});

const embeddings = new BedrockEmbeddings({
  model: "amazon.titan-embed-text-v1",
  region: "us-east-1",
});

const model = new BedrockChat({
  model: "meta.llama2-13b-chat-v1",
  region: "us-east-1",
  temperature: 0.3,
  maxTokens: 1000,
});

async function getPineconeClient() {
  const pineConeSecret = await secretsManager
    .getSecretValue({
      SecretId: "pinecone-credentials",
    })
    .promise();
  const parsedPineConeSecret = JSON.parse(pineConeSecret.SecretString);
  return new Pinecone({ apiKey: parsedPineConeSecret.apiKey });
}

function formatChatHistory(human, ai, previousChatHistory) {
  const newInteraction = `Human: ${human}\nAI: ${ai}`;
  if (!previousChatHistory) {
    return newInteraction;
  }
  return `${previousChatHistory}\n\n${newInteraction}`;
}

async function getChain() {
  const pinecone = await getPineconeClient();
  const pineconeIndex = pinecone.index("document-kb");
  const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex,
  });
  const retriever = vectorStore.asRetriever();

  const questionPrompt = PromptTemplate.fromTemplate(
    `Restrict your response to the provided context when answering the question. If unsure, admit lack of knowledge instead of speculating. Keep the response brief and focused solely on answering the question.
  ----------------
  CONTEXT: {context}
  ----------------
  CHAT HISTORY: {chatHistory}
  ----------------
  QUESTION: {question}
  ----------------
  Helpful Answer:`,
  );

  return RunnableSequence.from([
    {
      question: (input) => input.question,
      chatHistory: (input) => input.chatHistory ?? "",
      context: async (input) => {
        const relevantDocs = await retriever.getRelevantDocuments(
          input.question,
        );
        return formatDocumentsAsString(relevantDocs);
      },
    },
    questionPrompt,
    model,
    new StringOutputParser(),
  ]);
}

exports.handler = async (event, context) => {
  const validated = validateAccess(event);
  if (!validated.valid) {
    return validated.response;
  }
  const requestBody = parseBody(event);

  if (!requestBody.question || typeof requestBody.question !== "string") {
    return formatError({
      message: "question is required and must be a string",
      statusCode: 400,
    });
  }

  const chain = await getChain();

  const result = await chain.invoke({
    question: requestBody.question,
    chatHistory: requestBody.chatHistory,
  });

  const chatHistory = formatChatHistory(
    requestBody.question,
    result,
    requestBody.chatHistory,
  );

  return formatResponse({ chatHistory, result });
};
