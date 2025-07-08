import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {SecretManagerServiceClient} from "@google-cloud/secret-manager";
import OpenAI from "openai";

// Initialize Firebase Admin
admin.initializeApp();

const db = admin.firestore();
const storage = admin.storage();
const secretManager = new SecretManagerServiceClient();

// Define types
interface ProcessSceneRequest {
  prompt: string;
  sceneData?: any; // Current scene objects
}

interface GenerationDoc {
  userId: string;
  status: "pending" | "processing" | "completed" | "failed";
  prompt: string;
  result?: any;
  error?: string;
  createdAt: admin.firestore.Timestamp;
}

/**
 * Get secret from Secret Manager
 */
async function getSecret(secretName: string): Promise<string> {
  try {
    const projectId = process.env.GCLOUD_PROJECT || "vibecad-gai";
    const [version] = await secretManager.accessSecretVersion({
      name: `projects/${projectId}/secrets/${secretName}/versions/latest`,
    });
    return version.payload?.data?.toString() || "";
  } catch (error) {
    functions.logger.error(`Failed to access secret ${secretName}:`, error);
    throw new Error(`Failed to access secret: ${secretName}`);
  }
}

/**
 * Callable function to process scene with OpenAI
 */
export const processScene = functions.https.onCall(
  async (data: ProcessSceneRequest, context) => {
    // Check authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "User must be authenticated"
      );
    }

    const userId = context.auth.uid;
    const {prompt, sceneData} = data;

    // Validate input
    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Prompt is required and must be a non-empty string"
      );
    }

    try {
      // Create initial generation document
      const generationRef = db.collection("generations").doc();
      const generationId = generationRef.id;

      const initialDoc: GenerationDoc = {
        userId,
        status: "pending",
        prompt: prompt.trim(),
        createdAt: admin.firestore.Timestamp.now(),
      };

      await generationRef.set(initialDoc);

      // Update status to processing
      await generationRef.update({status: "processing"});

      // Get OpenAI API key from Secret Manager
      const openaiApiKey = await getSecret("openai-api-key");
      
      // Initialize OpenAI client
      const openai = new OpenAI({
        apiKey: openaiApiKey,
      });

      // Process with OpenAI (same logic as current frontend)
      const systemPrompt = `You are an AI assistant for a 3D scene manipulation application using Babylon.js. 
      The user will give you commands to manipulate 3D objects in the scene.
      
      Current scene objects: ${JSON.stringify(sceneData || [])}
      
      Respond with a JSON object containing one of these actions:
      - {"action": "move", "targetId": "object-id", "x": 0, "y": 0, "z": 0}
      - {"action": "rotate", "targetId": "object-id", "x": 0, "y": 0, "z": 0} (in radians)
      - {"action": "scale", "targetId": "object-id", "x": 1, "y": 1, "z": 1}
      - {"action": "create", "type": "cube|sphere|cylinder", "x": 0, "y": 0, "z": 0, "color": "#hexcolor"}
      - {"action": "delete", "targetId": "object-id"}
      - {"action": "changeColor", "targetId": "object-id", "color": "#hexcolor"}
      
      Respond ONLY with the JSON object, no explanation.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {role: "system", content: systemPrompt},
          {role: "user", content: prompt},
        ],
        temperature: 0.7,
        max_tokens: 200,
      });

      const response = completion.choices[0]?.message?.content || "";
      let result;
      
      try {
        result = JSON.parse(response);
      } catch (e) {
        throw new Error("Failed to parse AI response");
      }

      // Update generation document with success
      await generationRef.update({
        status: "completed",
        result,
      });

      return {
        success: true,
        generationId,
        result,
      };
    } catch (error) {
      functions.logger.error("Error processing scene:", error);

      // Update generation document with error
      if (error instanceof Error) {
        await db.collection("generations").doc().update({
          status: "failed",
          error: error.message,
        });
      }

      throw new functions.https.HttpsError(
        "internal",
        "Failed to process scene command"
      );
    }
  }
);

/**
 * HTTP endpoint to check function health
 */
export const health = functions.https.onRequest((req, res) => {
  res.json({status: "healthy", timestamp: new Date().toISOString()});
});