import OpenAI from 'openai';
import type { SceneObject } from '../types/types';

export interface SceneCommand {
  action: 'move' | 'color' | 'scale' | 'create' | 'delete';
  objectId?: string;
  type?: string;
  x?: number;
  y?: number;
  z?: number;
  color?: string;
  size?: number;
}

export interface AIServiceResult {
  success: boolean;
  commands?: SceneCommand[];
  error?: string;
  userPrompt?: string;
  aiResponse?: string;
}

/**
 * AI Service for handling OpenAI API interactions and scene command generation
 */
export class AIService {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ 
      apiKey, 
      dangerouslyAllowBrowser: true 
    });
  }

  /**
   * Generate a description of the current scene
   */
  public describeScene(sceneObjects: SceneObject[]): string {
    const description = sceneObjects
      .map(obj => {
        if (obj.type === 'ground') return null;
        return `${obj.type} "${obj.id}" at position (${obj.position.x.toFixed(1)}, ${obj.position.y.toFixed(1)}, ${obj.position.z.toFixed(1)}) with color ${obj.color}`;
      })
      .filter(Boolean)
      .join(', ');
    
    return `Current scene contains: ${description || 'just a ground plane'}`;
  }

  /**
   * Generate the system prompt for the AI
   */
  private generateSystemPrompt(sceneDescription: string, objectIds: string[]): string {
    return `You are a 3D scene manipulation assistant. You can modify a Babylon.js scene based on natural language commands.

Current scene: ${sceneDescription}

Available actions:
1. move: Move an object to x,y,z coordinates
2. color: Change object color (use hex colors)
3. scale: Scale an object by x,y,z factors
4. create: Create new objects (cube, sphere, cylinder, plane, torus, cone)
5. delete: Remove an object

Respond ONLY with valid JSON containing an array of commands. Example:
[{"action": "move", "objectId": "cube-1", "x": 2, "y": 1, "z": 0}]
[{"action": "color", "objectId": "cube-1", "color": "#00ff00"}]
[{"action": "create", "type": "sphere", "x": 3, "y": 2, "z": 1, "color": "#ff0000", "size": 1.5}]

Object IDs currently in scene: ${objectIds.join(', ')}`;
  }

  /**
   * Clean AI response by removing markdown code blocks
   */
  private cleanResponse(response: string): string {
    let cleanedResponse = response.trim();
    
    // Remove markdown code blocks
    cleanedResponse = cleanedResponse.replace(/```json\s*/g, '');
    cleanedResponse = cleanedResponse.replace(/```\s*/g, '');
    cleanedResponse = cleanedResponse.trim();
    
    return cleanedResponse;
  }

  /**
   * Parse and validate AI response into commands
   */
  private parseCommands(response: string): SceneCommand[] {
    const cleanedResponse = this.cleanResponse(response);
    
    try {
      const parsed = JSON.parse(cleanedResponse);
      
      if (Array.isArray(parsed)) {
        return parsed as SceneCommand[];
      } else {
        return [parsed as SceneCommand];
      }
    } catch (error) {
      throw new Error(`Failed to parse AI response: ${error instanceof Error ? error.message : 'Unknown parsing error'}`);
    }
  }

  /**
   * Get scene commands from user prompt
   */
  public async getSceneCommands(
    prompt: string, 
    sceneObjects: SceneObject[]
  ): Promise<AIServiceResult> {
    if (!prompt.trim()) {
      return {
        success: false,
        error: 'Empty prompt provided'
      };
    }

    try {
      const sceneDescription = this.describeScene(sceneObjects);
      const objectIds = sceneObjects.map(obj => obj.id);
      const systemPrompt = this.generateSystemPrompt(sceneDescription, objectIds);

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 500
      });

      const aiResponse = response.choices[0]?.message?.content;
      
      if (!aiResponse) {
        return {
          success: false,
          error: 'No response from AI',
          userPrompt: prompt
        };
      }

      try {
        const commands = this.parseCommands(aiResponse);
        
        return {
          success: true,
          commands,
          userPrompt: prompt,
          aiResponse
        };
      } catch (parseError) {
        return {
          success: false,
          error: parseError instanceof Error ? parseError.message : 'Unknown parsing error',
          userPrompt: prompt,
          aiResponse
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown API error',
        userPrompt: prompt
      };
    }
  }

  /**
   * Validate if the service is properly initialized
   */
  public isReady(): boolean {
    return !!this.openai;
  }
}

/**
 * Factory function to create AI service instance
 */
export const createAIService = (apiKey: string): AIService => {
  return new AIService(apiKey);
};
