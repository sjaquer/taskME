"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle } from "lucide-react";
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useAppContextStore } from "@/lib/store";
import { MAX_TAGS_PER_TASK, TASK_STATUSES, filterTasks, isTaskStatus, groupTasksByStatus, parseTagInput, toInputDateValue } from "@/lib/tasks";
import { taskSchema } from "@/lib/schemas";
import { toast } from "@/hooks/use-toast";
import { useFirestore, useUser } from "@/firebase/provider";
import { useProjects, useTasks } from "@/firebase/user-data";
import { createTask, deleteTask, deleteTasks, updateTask } from "@/services/task-service";
import { createProject, updateProject, archiveProject } from "@/services/project-service";
import { restoreUserDocument, restoreUserDocuments } from "@/services/restore-service";
import { generateTasksFromPrompt } from "@/services/ai-task-service";
import { toastWithUndo } from "@/components/undo-toast";
import { TaskFormPanel, type TaskFormState } from "@/components/kanban/task-form-panel";
import { ProjectManager } from "@/components/kanban/project-manager";
import { StatusSection } from "@/components/kanban/status-section";
import { KanbanHeader } from "@/components/kanban/kanban-header";
import { KanbanToolbar, type KanbanViewMode } from "@/components/kanban/kanban-toolbar";
import { QuickCapture, type QuickCaptureDraft } from "@/components/kanban/quick-capture";
import { AiPlanner } from "@/components/kanban/ai-planner";
import { KanbanColumn } from "@/components/organisms/kanban-column";
import type { Priority, ProjectFormData, Task } from "@/types/task";

const INITIAL_TASK_FORM: TaskFormState = {
  title: "",
  description: "",
  priority: "media",
  status: TASK_STATUSES[0],
  tags: "",
  dueDate: "",
  projectId: "",
};

export default function KanbanPage() {
  const { context } = useAppContextStore();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const formPanelRef = useRef<HTMLDivElement>(null);

  // Firestore aplica las escrituras locales al instante (latency compensation),
  // así que no hace falta un estado optimista propio.
  const { data: tasks, isLoading: isTasksLoading } = useTasks(context);
  const { data: projects } = useProjects(context);

  const [viewMode, setViewMode] = useState<KanbanViewMode>("flow");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "all">("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [taskForm, setTaskForm] = useState<TaskFormState>(INITIAL_TASK_FORM);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [confirmClearCompleted, setConfirmClearCompleted] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const projectsById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const activeProjects = useMemo(() => projects.filter((p) => !p.archived), [projects]);

  const visibleTasks = useMemo(
    () => filterTasks(tasks, { priority: priorityFilter, projectId: projectFilter, query: searchQuery }),
    [tasks, priorityFilter, projectFilter, searchQuery]
  );
  const groupedTasks = useMemo(() => groupTasksByStatus(visibleTasks), [visibleTasks]);

  const stats = useMemo(
    () => ({
      total: tasks.length,
      completed: tasks.filter((task) => task.status === "Hecho").length,
      inProgress: tasks.filter((task) => task.status === "Haciendo").length,
      critical: tasks.filter((task) => task.priority === "alta" && task.status !== "Hecho").length,
    }),
    [tasks]
  );
  const hasSearch = searchQuery.trim().length > 0;

  // Sin diálogo modal: el primer toque en "Limpiar Hechos" pide confirmación y el segundo borra.
  useEffect(() => {
    if (!confirmClearCompleted) return;
    const timeoutId = setTimeout(() => setConfirmClearCompleted(false), 4000);
    return () => clearTimeout(timeoutId);
  }, [confirmClearCompleted]);

  if (isUserLoading || !user) {
    return null;
  }

  const openTaskForm = (seed?: Partial<TaskFormState>, task?: Task) => {
    if (task) {
      setEditingTask(task);
      setTaskForm({
        title: task.title,
        description: task.description || "",
        priority: task.priority,
        status: task.status,
        tags: task.tags?.join(", ") || "",
        dueDate: toInputDateValue(task.dueDate),
        projectId: task.projectId || "",
      });
    } else {
      setEditingTask(null);
      setTaskForm({ ...INITIAL_TASK_FORM, ...seed });
    }

    setFormOpen(true);
    requestAnimationFrame(() => {
      formPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const closeTaskForm = () => {
    setFormOpen(false);
    setEditingTask(null);
    setTaskForm(INITIAL_TASK_FORM);
  };

  /** Valida y guarda; devuelve false si la validación falla. */
  const saveTask = (draft: TaskFormState, taskToUpdate: Task | null): boolean => {
    const result = taskSchema.safeParse({
      title: draft.title,
      description: draft.description,
      priority: draft.priority,
      status: draft.status || TASK_STATUSES[0],
      tags: parseTagInput(draft.tags),
      ...(draft.dueDate ? { dueDate: draft.dueDate } : {}),
      context,
      ...(draft.projectId ? { projectId: draft.projectId } : {}),
    });

    if (!result.success) {
      toast({ variant: "destructive", title: "Error", description: result.error.errors[0].message });
      return false;
    }

    if (taskToUpdate) {
      updateTask(firestore, user.uid, taskToUpdate.id, result.data);
      toast({ variant: "success", title: "Tarea actualizada" });
    } else {
      createTask(firestore, user.uid, result.data);
      toast({ variant: "success", title: "Tarea creada" });
    }
    return true;
  };

  const handleSubmitForm = () => {
    setIsSaving(true);
    try {
      if (saveTask(taskForm, editingTask)) closeTaskForm();
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickCreate = async (draft: QuickCaptureDraft) => {
    if (!draft.title.trim()) {
      toast({ variant: "destructive", title: "Falta el título", description: "Escribe una tarea corta para crearla rápido." });
      return false;
    }
    return saveTask({ ...INITIAL_TASK_FORM, ...draft }, null);
  };

  const handleDeleteTask = (taskId: string) => {
    const deletedTask = tasks.find((task) => task.id === taskId);
    deleteTask(firestore, user.uid, taskId);

    if (!deletedTask) {
      toast({ variant: "warning", title: "Tarea eliminada" });
      return;
    }
    toastWithUndo({
      title: "Tarea eliminada",
      description: deletedTask.title,
      onUndo: () => restoreUserDocument(firestore, user.uid, "tasks", deletedTask),
    });
  };

  const handleMoveTask = (taskId: string, status: string) => {
    if (!isTaskStatus(status)) return;
    updateTask(firestore, user.uid, taskId, { status });
    toast({ variant: "success", title: "Estado actualizado", description: `Ahora está en ${status}.` });
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) return;
    const overId = String(over.id);
    // Se puede soltar sobre una columna (id = estado) o sobre otra tarjeta.
    const targetStatus = tasks.find((task) => task.id === overId)?.status ?? overId;
    const currentTask = tasks.find((task) => task.id === active.id);
    if (currentTask && currentTask.status !== targetStatus) {
      handleMoveTask(currentTask.id, targetStatus);
    }
  };

  const handleClearCompleted = async () => {
    const completedList = tasks.filter((task) => task.status === "Hecho");
    if (completedList.length === 0) {
      toast({ variant: "warning", title: "Sin tareas hechas", description: "No hay tareas completadas para limpiar." });
      return;
    }

    if (!confirmClearCompleted) {
      setConfirmClearCompleted(true);
      return;
    }
    setConfirmClearCompleted(false);

    try {
      await deleteTasks(firestore, user.uid, completedList.map((task) => task.id));
    } catch (error) {
      console.error("Error al limpiar tareas completadas:", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudieron eliminar las tareas completadas." });
      return;
    }

    toastWithUndo({
      title: "Tablero limpio",
      description: `Se eliminaron ${completedList.length} tareas completadas.`,
      onUndo: () => {
        restoreUserDocuments(firestore, user.uid, "tasks", completedList).catch((error) => {
          console.error("Error al restaurar tareas:", error);
          toast({ variant: "destructive", title: "Error", description: "No se pudieron restaurar las tareas." });
        });
      },
    });
  };

  const handleGenerateTasks = async (prompt: string) => {
    if (!prompt.trim()) return false;

    setIsGenerating(true);
    try {
      const generatedTasks = await generateTasksFromPrompt(user, prompt);
      const targetStatus = TASK_STATUSES[0];
      let createdCount = 0;

      for (const item of generatedTasks) {
        const normalized = taskSchema.safeParse({
          title: String(item.title ?? "").trim(),
          description: String(item.description ?? "").trim(),
          priority: item.priority,
          status: targetStatus,
          tags: Array.isArray(item.tags) ? parseTagInput(item.tags.map(String).join(",")) : [],
          dueDate: typeof item.dueDate === "string" && item.dueDate.trim() ? item.dueDate : undefined,
          context,
        });
        if (!normalized.success) continue;

        createTask(firestore, user.uid, normalized.data);
        createdCount += 1;
      }

      if (createdCount === 0) {
        throw new Error("La IA no generó tareas aprovechables.");
      }

      toast({ variant: "success", title: "Tareas creadas con IA", description: `${createdCount} tareas agregadas a ${targetStatus}.` });
      return true;
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error en IA",
        description: error instanceof Error ? error.message : "No se pudo procesar la solicitud.",
      });
      return false;
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateProject = (data: ProjectFormData) => {
    createProject(firestore, user.uid, { ...data, context });
    toast({ variant: "success", title: "Proyecto creado" });
  };

  const handleUpdateProject = (projectId: string, data: ProjectFormData) => {
    updateProject(firestore, user.uid, projectId, { ...data });
    toast({ variant: "success", title: "Proyecto actualizado" });
  };

  const handleArchiveProject = (projectId: string) => {
    archiveProject(firestore, user.uid, projectId);
    if (projectFilter === projectId) setProjectFilter("all");
    toast({ variant: "warning", title: "Proyecto archivado" });
  };

  return (
    <div className="space-y-6 pb-12 max-w-[1400px] mx-auto px-0">
      <section className="rounded-[28px] border border-border bg-gradient-to-br from-background via-card/40 to-background p-6 shadow-md md:p-8">
        <div className="flex flex-col gap-6">
          <KanbanHeader {...stats} />
          <KanbanToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            priorityFilter={priorityFilter}
            onPriorityFilterChange={setPriorityFilter}
            projectFilter={projectFilter}
            onProjectFilterChange={setProjectFilter}
            projects={activeProjects}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onNewTask={() => openTaskForm()}
            onClearCompleted={handleClearCompleted}
            confirmClearCount={confirmClearCompleted ? stats.completed : null}
          />
        </div>
      </section>

      <ProjectManager
        projects={projects}
        onCreate={handleCreateProject}
        onUpdate={handleUpdateProject}
        onArchive={handleArchiveProject}
      />

      {/* Formulario embebido de tarea (crear/editar) — sin modal */}
      {formOpen && (
        <div ref={formPanelRef}>
          <TaskFormPanel
            isEditing={Boolean(editingTask)}
            value={taskForm}
            onChange={(patch) => setTaskForm((previous) => ({ ...previous, ...patch }))}
            onSubmit={handleSubmitForm}
            onCancel={closeTaskForm}
            isSaving={isSaving}
            statusOptions={TASK_STATUSES}
            projects={activeProjects}
            maxTags={MAX_TAGS_PER_TASK}
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <QuickCapture isSaving={isSaving} onCreate={handleQuickCreate} onAddDetails={(draft) => openTaskForm(draft)} />
        <AiPlanner isGenerating={isGenerating} onGenerate={handleGenerateTasks} />
      </div>

      <div className="border-t border-border/40 pt-6">
        {isTasksLoading && visibleTasks.length === 0 ? (
          <div className="space-y-4">
            {[0, 1, 2].map((index) => (
              <div key={index} className="h-28 animate-pulse rounded-3xl border border-border bg-muted/15" />
            ))}
          </div>
        ) : visibleTasks.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-border bg-muted/10 px-6 py-16 text-center">
            <CheckCircle className="mx-auto w-12 h-12 text-muted-foreground/30 stroke-[1]" />
            <p className="mt-4 text-sm font-bold text-foreground">
              {hasSearch ? "No se encontraron tareas coincidentes." : "No hay tareas en esta categoría."}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {hasSearch ? "Intenta con otra palabra clave." : "Crea una tarea arriba para comenzar."}
            </p>
          </div>
        ) : viewMode === "flow" ? (
          <div className="space-y-4">
            {TASK_STATUSES.map((status) => (
              <StatusSection
                key={status}
                status={status}
                tasks={groupedTasks.get(status) || []}
                projectsById={projectsById}
                onAdd={(presetStatus) => openTaskForm({ status: presetStatus })}
                onEdit={(task) => openTaskForm(undefined, task)}
                onDelete={handleDeleteTask}
                onMove={handleMoveTask}
              />
            ))}
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
            <div className="flex gap-6 overflow-x-auto pb-6 snap-x scrollbar-hide">
              {TASK_STATUSES.map((status) => (
                <KanbanColumn
                  key={status}
                  status={status}
                  tasks={groupedTasks.get(status) || []}
                  onDelete={handleDeleteTask}
                  onEdit={(task) => openTaskForm(undefined, task)}
                />
              ))}
            </div>
          </DndContext>
        )}
      </div>
    </div>
  );
}
