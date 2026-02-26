// Type definitions matching Go backend models

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface Command {
  id: string;
  title: string;
  description: string;
  commandText: string;
  tags: string[];
  categoryId: string;
  createdAt: string;
  updatedAt: string;
}

export interface VariablePrompt {
  name: string;
  placeholder: string;
  defaultValue: string;
}

export interface ExecutionResult {
  output: string;
  error: string;
  exitCode: number;
}
