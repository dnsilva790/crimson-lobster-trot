import { Project } from "@/lib/types";

const PROJECTS_STORAGE_KEY = "project_management_projects"; // Renomeado

/**
 * Carrega todos os projetos do localStorage.
 * @returns Um array de objetos Project.
 */
export const getProjects = (): Project[] => {
  try {
    const storedProjects = localStorage.getItem(PROJECTS_STORAGE_KEY);
    return storedProjects ? JSON.parse(storedProjects) : [];
  } catch (error) {
    console.error("Falha ao carregar projetos do localStorage", error);
    return [];
  }
};

/**
 * Salva a lista completa de projetos no localStorage.
 * @param projects O array de projetos a ser salvo.
 */
export const saveProjects = (projects: Project[]): void => {
  try {
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
  } catch (error) {
    console.error("Falha ao salvar projetos no localStorage", error);
  }
};

/**
 * Adiciona um novo projeto à lista e o salva no localStorage.
 * @param newProject O novo projeto a ser adicionado.
 * @returns A lista atualizada de projetos.
 */
export const addProject = (newProject: Project): Project[] => {
  const projects = getProjects();
  const updatedProjects = [...projects, newProject];
  saveProjects(updatedProjects);
  return updatedProjects;
};

/**
 * Atualiza um projeto existente na lista e o salva no localStorage.
 * @param updatedProject O projeto com os dados atualizados.
 * @returns A lista atualizada de projetos.
 */
export const updateProject = (updatedProject: Project): Project[] => {
  const projects = getProjects();
  const updatedProjects = projects.map((project) =>
    project.id === updatedProject.id ? updatedProject : project
  );
  saveProjects(updatedProjects);
  return updatedProjects;
};

/**
 * Deleta um projeto da lista e o salva no localStorage.
 * @param projectId O ID do projeto a ser deletado.
 * @returns A lista atualizada de projetos.
 */
export const deleteProject = (projectId: string): Project[] => {
  const projects = getProjects();
  const updatedProjects = projects.filter((project) => project.id !== projectId);
  saveProjects(updatedProjects);
  return updatedProjects;
};