import OpenAI from 'openai';
import type { SceneObject } from '../types/types';

export interface SceneCommand {
  action: 'move' | 'color' | 'scale' | 'create' | 'delete';
  objectId?: string;
  type?: 'cube' | 'sphere' | 'cylinder' | 'plane' | 'torus' | 'cone' | 'house-basic' | 'house-room' | 'house-hallway' | 'house-roof-flat' | 'house-roof-pitched';
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
    const housingObjects = sceneObjects.filter(obj => obj.type.startsWith('house-'));
    const primitiveObjects = sceneObjects.filter(obj => !obj.type.startsWith('house-') && obj.type !== 'ground');
    
    let description = '';
    
    if (housingObjects.length > 0) {
      const housingDescription = housingObjects
        .map(obj => {
          const friendlyType = obj.type.replace('house-', '').replace('-', ' ');
          return `${friendlyType} "${obj.id}" at (${obj.position.x.toFixed(1)}, ${obj.position.y.toFixed(1)}, ${obj.position.z.toFixed(1)})`;
        })
        .join(', ');
      description += `Housing structures: ${housingDescription}`;
    }
    
    if (primitiveObjects.length > 0) {
      const primitiveDescription = primitiveObjects
        .map(obj => `${obj.type} "${obj.id}" at (${obj.position.x.toFixed(1)}, ${obj.position.y.toFixed(1)}, ${obj.position.z.toFixed(1)})`)
        .join(', ');
      description += (description ? '; ' : '') + `Objects: ${primitiveDescription}`;
    }
    
    return `Current scene contains: ${description || 'just a ground plane'}`;
  }

  /**
   * Generate the system prompt for the AI
   */
  private generateSystemPrompt(sceneDescription: string, objectIds: string[]): string {
    return `You are a 3D architectural scene assistant. You can modify a Babylon.js scene with both basic objects and housing structures.

Current scene: ${sceneDescription}

Available actions:
1. move: Move an object to x,y,z coordinates
2. color: Change object color (use hex colors)
3. scale: Scale an object by x,y,z factors
4. create: Create objects
5. delete: Remove an object

OBJECT TYPES:
Basic: cube, sphere, cylinder, plane, torus, cone
Housing: house-basic, house-room, house-hallway, house-roof-flat, house-roof-pitched

ARCHITECTURAL INTELLIGENCE:
- Rooms typically connect to hallways at ground level (y=0)
- Roofs go above existing structures (add 2-3 units to y position)
- Houses and rooms should be spaced 3-4 units apart when "connecting"
- Hallways can bridge between rooms (position between them)
- Use appropriate colors: browns for houses, grays for hallways, darker colors for roofs

POSITIONING LOGIC:
- Ground level objects: y=0
- Roofs above structures: y=2 to y=3
- When connecting structures, maintain 3-4 unit spacing
- Hallways should be positioned to logically connect rooms

NATURAL LANGUAGE UNDERSTANDING:
- "add roof" = create appropriate roof type above existing structure
- "connect rooms" = create hallway between existing rooms
- "build house" = create house-basic
- "create room" = create house-room
- "make hallway" = create house-hallway
- "flat roof" = house-roof-flat
- "pitched roof" = house-roof-pitched

EXAMPLES:
Add roof to house: [{"action": "create", "type": "house-roof-pitched"}]
Connect rooms with hallway: [{"action": "create", "type": "house-hallway"}]
Create house layout: [{"action": "create", "type": "house-basic"}, {"action": "create", "type": "house-room"}]
Build 3 connected rooms: [{"action": "create", "type": "house-room"}, {"action": "create", "type": "house-room"}, {"action": "create", "type": "house-room"}, {"action": "create", "type": "house-hallway"}]

Respond ONLY with valid JSON array of commands.

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
      const architecturalContext = this.extractArchitecturalContext(prompt);
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
        const rawCommands = this.parseCommands(aiResponse);
        const commands = this.enhanceCommandsWithArchitecturalLogic(rawCommands, sceneObjects, architecturalContext);
        
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
   * Find the best position to place a roof above existing structures
   */
  private findRoofPosition(sceneObjects: SceneObject[], targetStructure?: string): { x: number, y: number, z: number } | null {
    // If a specific structure is mentioned, try to find it
    if (targetStructure) {
      const target = sceneObjects.find(obj => 
        obj.id.toLowerCase().includes(targetStructure.toLowerCase()) || 
        obj.type.toLowerCase().includes(targetStructure.toLowerCase())
      );
      if (target) {
        return { x: target.position.x, y: target.position.y + 2.5, z: target.position.z };
      }
    }
    
    // Otherwise, find the first house or room structure
    const structures = sceneObjects.filter(obj => 
      obj.type.startsWith('house-') && 
      !obj.type.includes('roof') &&
      obj.type !== 'ground'
    );
    
    if (structures.length > 0) {
      const structure = structures[0];
      return { x: structure.position.x, y: structure.position.y + 2.5, z: structure.position.z };
    }
    
    return null;
  }

  /**
   * Extract architectural context from user prompt
   */
  private extractArchitecturalContext(prompt: string): { targetStructure?: string; connectionIntent?: boolean } {
    const lowerPrompt = prompt.toLowerCase();
    
    // Look for references to specific structures
    const objectMatches = lowerPrompt.match(/(?:to|on|above|for)\s+(\w+(?:-\w+)*)/g);
    let targetStructure: string | undefined;
    
    if (objectMatches) {
      for (const match of objectMatches) {
        const extracted = match.replace(/^(?:to|on|above|for)\s+/, '');
        if (extracted.includes('house') || extracted.includes('room') || extracted.includes('hall')) {
          targetStructure = extracted;
          break;
        }
      }
    }
    
    // Check for connection intent
    const connectionKeywords = ['connect', 'link', 'join', 'bridge', 'between'];
    const connectionIntent = connectionKeywords.some(keyword => lowerPrompt.includes(keyword));
    
    return { targetStructure, connectionIntent };
  }

  /**
   * Find the best position to connect structures (like rooms with hallways)
   */
  private findConnectionPosition(sceneObjects: SceneObject[], type: string): { x: number, y: number, z: number } {
    const structures = sceneObjects.filter(obj => 
      obj.type.startsWith('house-') && 
      !obj.type.includes('roof') &&
      obj.type !== 'ground'
    );
    
    if (structures.length === 0) {
      return { x: 0, y: 0, z: 0 };
    }
    
    if (structures.length === 1) {
      // Position next to the existing structure
      const existing = structures[0];
      return { x: existing.position.x + 4, y: 0, z: existing.position.z };
    }
    
    // If multiple structures, try to position between them or extend the layout
    const avgX = structures.reduce((sum, obj) => sum + obj.position.x, 0) / structures.length;
    const avgZ = structures.reduce((sum, obj) => sum + obj.position.z, 0) / structures.length;
    
    if (type === 'house-hallway') {
      // Hallways should connect structures
      return { x: avgX, y: 0, z: avgZ };
    } else {
      // Other structures should extend the layout
      const maxX = Math.max(...structures.map(obj => obj.position.x));
      return { x: maxX + 4, y: 0, z: avgZ };
    }
  }

  /**
   * Enhance the AI response with architectural intelligence
   */
  private enhanceCommandsWithArchitecturalLogic(commands: SceneCommand[], sceneObjects: SceneObject[], context?: { targetStructure?: string; connectionIntent?: boolean }): SceneCommand[] {
    return commands.map(command => {
      if (command.action === 'create') {
        // Auto-position housing objects intelligently
        if (command.type?.startsWith('house-')) {
          if (command.type.includes('roof')) {
            // Position roofs above existing structures
            const roofPos = this.findRoofPosition(sceneObjects, context?.targetStructure);
            if (roofPos && command.x === undefined && command.y === undefined && command.z === undefined) {
              return { ...command, ...roofPos };
            }
          } else {
            // Position other housing structures logically
            const connectionPos = this.findConnectionPosition(sceneObjects, command.type);
            if (command.x === undefined && command.y === undefined && command.z === undefined) {
              return { ...command, ...connectionPos };
            }
          }
        }
        
        // Set default colors for housing objects if not specified
        if (command.type?.startsWith('house-') && !command.color) {
          const colorMap: { [key: string]: string } = {
            'house-basic': '#8B4513',
            'house-room': '#DEB887',
            'house-hallway': '#808080',
            'house-roof-flat': '#654321',
            'house-roof-pitched': '#654321'
          };
          return { ...command, color: colorMap[command.type] || '#8B4513' };
        }
      }
      
      return command;
    });
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
