"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.health = exports.processScene = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const secret_manager_1 = require("@google-cloud/secret-manager");
const openai_1 = __importDefault(require("openai"));
// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();
// const storage = admin.storage(); // Will use this later for storing generated models
const secretManager = new secret_manager_1.SecretManagerServiceClient();
/**
 * Get secret from Secret Manager
 */
async function getSecret(secretName) {
    var _a, _b;
    try {
        const projectId = process.env.GCLOUD_PROJECT || "vibecad-gai";
        const [version] = await secretManager.accessSecretVersion({
            name: `projects/${projectId}/secrets/${secretName}/versions/latest`,
        });
        return ((_b = (_a = version.payload) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.toString()) || "";
    }
    catch (error) {
        functions.logger.error(`Failed to access secret ${secretName}:`, error);
        throw new Error(`Failed to access secret: ${secretName}`);
    }
}
/**
 * Callable function to process scene with OpenAI
 */
exports.processScene = functions.https.onCall(async (data, context) => {
    var _a, _b, _c;
    // Check authentication
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
    }
    const userId = context.auth.uid;
    const { generationId, prompt, sceneData } = data;
    // Validate input
    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
        throw new functions.https.HttpsError("invalid-argument", "Prompt is required and must be a non-empty string");
    }
    let generationRef;
    try {
        // Use existing generation document or create new one
        if (generationId) {
            generationRef = db.collection("generations").doc(generationId);
            // Verify the generation belongs to this user
            const genDoc = await generationRef.get();
            if (!genDoc.exists || ((_a = genDoc.data()) === null || _a === void 0 ? void 0 : _a.userId) !== userId) {
                throw new functions.https.HttpsError("permission-denied", "Invalid generation ID");
            }
            // Update status to processing
            await generationRef.update({ status: "processing" });
        }
        else {
            // Create new generation document (backward compatibility)
            generationRef = db.collection("generations").doc();
            const initialDoc = {
                userId,
                status: "processing",
                prompt: prompt.trim(),
                createdAt: admin.firestore.Timestamp.now(),
            };
            await generationRef.set(initialDoc);
        }
        // Get OpenAI API key from Secret Manager
        const openaiApiKey = await getSecret("open-api-key");
        // Initialize OpenAI client
        const openai = new openai_1.default({
            apiKey: openaiApiKey,
        });
        // Process with OpenAI (same logic as current frontend)
        const systemPrompt = `You are an AI assistant for a 3D scene manipulation application using Babylon.js. 
      The user will give you commands to manipulate 3D objects in the scene.
      
      Current scene objects: ${JSON.stringify(sceneData || [])}
      
      Respond with a JSON object containing one of these actions:
      - {"action": "move", "objectId": "object-id", "x": 0, "y": 0, "z": 0}
      - {"action": "rotate", "objectId": "object-id", "x": 0, "y": 0, "z": 0} (in radians)
      - {"action": "scale", "objectId": "object-id", "x": 1, "y": 1, "z": 1}
      - {"action": "create", "type": "cube|sphere|cylinder", "x": 0, "y": 0, "z": 0, "color": "#hexcolor"}
      - {"action": "delete", "objectId": "object-id"}
      - {"action": "color", "objectId": "object-id", "color": "#hexcolor"}
      
      Respond ONLY with the JSON object, no explanation.`;
        const completion = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: prompt },
            ],
            temperature: 0.7,
            max_tokens: 200,
        });
        const response = ((_c = (_b = completion.choices[0]) === null || _b === void 0 ? void 0 : _b.message) === null || _c === void 0 ? void 0 : _c.content) || "";
        let result;
        try {
            result = JSON.parse(response);
        }
        catch (e) {
            throw new Error("Failed to parse AI response");
        }
        // Update generation document with success
        await generationRef.update({
            status: "completed",
            result,
        });
        return {
            success: true,
            generationId: generationRef.id,
            result,
        };
    }
    catch (error) {
        functions.logger.error("Error processing scene:", error);
        // Update generation document with error if we have a reference
        if (generationRef && error instanceof Error) {
            try {
                await generationRef.update({
                    status: "failed",
                    error: error.message,
                });
            }
            catch (updateError) {
                functions.logger.error("Failed to update error status:", updateError);
            }
        }
        throw new functions.https.HttpsError("internal", error instanceof Error ? error.message : "Failed to process scene command");
    }
});
/**
 * HTTP endpoint to check function health
 */
exports.health = functions.https.onRequest((req, res) => {
    res.json({ status: "healthy", timestamp: new Date().toISOString() });
});
//# sourceMappingURL=index.js.map