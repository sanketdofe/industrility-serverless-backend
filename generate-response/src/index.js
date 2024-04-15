const AWS = require("aws-sdk");
const {Pinecone} = require("@pinecone-database/pinecone");
const {PineconeStore} = require("@langchain/pinecone");
const {
    BedrockEmbeddings,
} = require("@langchain/community/embeddings/bedrock");
const {RunnableSequence} = require("@langchain/core/runnables");
const {formatDocumentsAsString} = require("langchain/util/document");
const {StringOutputParser} = require("@langchain/core/output_parsers");
const {PromptTemplate} = require("@langchain/core/prompts");
const {BedrockChat} = require("@langchain/community/chat_models/bedrock");
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
    return new Pinecone({apiKey: parsedPineConeSecret.apiKey});
}

function formatChatHistory(chatHistory) {
    return chatHistory.map((interaction) => interaction.type === 'human' ? `[INST] ${interaction.text}  [/INST]` : interaction.text
    ).join('\n');
}

const convertS3DirectoryToPineConeNamespace = (s3Key) => {
    return s3Key
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, "-");
};

async function getChain(documentGroup) {
    const formattedChatNamespace =
        convertS3DirectoryToPineConeNamespace(documentGroup);
    const pinecone = await getPineconeClient();
    const pineconeIndex = pinecone.index("document-kb");
    const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
        pineconeIndex,
        namespace: formattedChatNamespace,
    });
    const retriever = vectorStore.asRetriever();

    const questionPrompt = PromptTemplate.fromTemplate(
        `
    <<SYS>> You're are a helpful Assistant. Use the following pieces of context to answer the question at the end. If you don't know the answer, just say that you don't know, don't try to make up an answer. Be precise, concise, and casual. Keep it short <</SYS>>
  ----------------
  CONTEXT: {context}
  ----------------
  CHAT HISTORY: {chatHistory}
  ----------------
  QUESTION: [INST] {question} [/INST]
  ----------------
  Helpful Answer:`,
    );

    return RunnableSequence.from([
        {
            question: (input) => input.question,
            chatHistory: (input) => formatChatHistory(input.chatHistory ?? []),
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

    if (
        !requestBody.chatId ||
        typeof requestBody.chatId !== "string"
    ) {
        return formatError({
            message: "chatId is required and must be a string",
            statusCode: 400,
        });
    }

    const previousChatHistory = requestBody.chatHistory;

    const chain = await getChain(requestBody.chatId);

    const result = await chain.invoke({
        question: requestBody.question,
        chatHistory: requestBody.chatHistory,
    });


    const newChatHistory = previousChatHistory && Array.isArray(previousChatHistory) ? [...previousChatHistory] : [];
    newChatHistory.push({type: "human", text: requestBody.question});
    newChatHistory.push({type: "agent", text: result});


    return formatResponse({chatHistory: newChatHistory, result});
};
