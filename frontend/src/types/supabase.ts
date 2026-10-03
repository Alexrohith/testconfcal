export interface Database {
  public: {
    Tables: {
      user_interests: {
        Row: {
          user_id: string;
          category_id: number;
        };
        Insert: {
          user_id: string;
          category_id: number;
        };
        Update: {
          user_id?: string;
          category_id?: number;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}