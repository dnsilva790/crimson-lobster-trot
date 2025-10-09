import { InternalTask } from "@/lib/types";

const INTERNAL_TASKS_STORAGE_KEY = "internal_tasks";

export const getInternalTasks = (): InternalTask[] => {
  try {
    const storedTasks = localStorage.getItem(INTERNAL_TASKS_STORAGE_KEY);
    return storedTasks ? JSON.parse(storedTasks) : [];
  } catch (error) {
    console.error("Failed to load internal tasks from localStorage", error);
    return [];
  }
};

export const saveInternalTasks = (tasks: InternalTask[]): void => {
  try {
    localStorage.setItem(INTERNAL_TASKS_STORAGE_KEY, JSON.stringify(tasks));
  } catch (error) {
    console.error("Failed to save internal tasks to localStorage", error);
  }
};

export const addInternalTask = (newTask: InternalTask): InternalTask[] => {
  const tasks = getInternalTasks();
  const updatedTasks = [...tasks, newTask];
  saveInternalTasks(updatedTasks);
  return updatedTasks;
};

export const updateInternalTask = (updatedTask: InternalTask): InternalTask[] => {
  const tasks = getInternalTasks();
  const updatedTasks = tasks.map((task) =>
    task.id === updatedTask.id ? updatedTask : task
  );
  saveInternalTasks(updatedTasks);
  return updatedTasks;
};

export const deleteInternalTask = (taskId: string): InternalTask[] => {
  const tasks = getInternalTasks();
  const updatedTasks = tasks.filter((task) => task.id !== taskId);
  saveInternalTasks(updatedTasks);
  return updatedTasks;
};