declare global {
  interface Window {
    verb: {
      geom: {
        NurbsSurface: {
          new(data: any): {
            tessellate(options?: {
              minDivsU?: number;
              minDivsV?: number;
              refine?: boolean;
            }): {
              points: number[][];
              faces: number[][];
              normals: number[][];
              uvs: number[][];
            };
            
            controlPoints(): number[][][];
            knotsU(): number[];
            knotsV(): number[];
            degreeU(): number;
            degreeV(): number;
            weights(): number[][];
          };
          
          byKnotsControlPointsWeights(
            degreeU: number,
            degreeV: number,
            knotsU: number[],
            knotsV: number[],
            controlPoints: number[][][],
            weights?: number[][]
          ): {
            tessellate(options?: {
              minDivsU?: number;
              minDivsV?: number;
              refine?: boolean;
            }): {
              points: number[][];
              faces: number[][];
              normals: number[][];
              uvs: number[][];
            };
            
            controlPoints(): number[][][];
            knotsU(): number[];
            knotsV(): number[];
            degreeU(): number;
            degreeV(): number;
            weights(): number[][];
          };
        };
      };
    };
  }
} 