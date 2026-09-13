'use client';

import { useState } from 'react';
import { ChevronDown, FolderKanban, Pencil, Archive, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Project, ProjectFormData } from '@/types/task';

const PROJECT_COLORS = [
  '#39FF14', '#3B82F6', '#A855F7', '#F97316', '#EF4444', '#EC4899', '#EAB308',
];

const INITIAL_FORM: ProjectFormData = { name: '', category: '', color: PROJECT_COLORS[0] };

interface ProjectManagerProps {
  projects: Project[];
  onCreate: (data: ProjectFormData) => void;
  onUpdate: (projectId: string, data: ProjectFormData) => void;
  onArchive: (projectId: string) => void;
  isSaving: boolean;
}

export function ProjectManager({ projects, onCreate, onUpdate, onArchive, isSaving }: ProjectManagerProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [form, setForm] = useState<ProjectFormData>(INITIAL_FORM);

  const visibleProjects = projects.filter((project) => !project.archived);

  const openCreateForm = () => {
    setEditingProject(null);
    setForm(INITIAL_FORM);
    setFormOpen(true);
  };

  const openEditForm = (project: Project) => {
    setEditingProject(project);
    setForm({ name: project.name, category: project.category, color: project.color });
    setFormOpen(true);
  };

  const closeForm = () => {
    setEditingProject(null);
    setForm(INITIAL_FORM);
    setFormOpen(false);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    if (editingProject) {
      onUpdate(editingProject.id, form);
    } else {
      onCreate(form);
    }
    closeForm();
  };

  return (
    <details className="group rounded-[28px] border border-border bg-card/50 shadow-sm" open={visibleProjects.length > 0}>
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 md:px-5">
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
        <div className="min-w-0 flex-1 flex items-center gap-2">
          <FolderKanban className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Proyectos</h3>
          <Badge variant="outline" className="rounded-full border-border bg-muted/40 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            {visibleProjects.length}
          </Badge>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            openCreateForm();
          }}
          className="h-8 rounded-xl bg-primary/10 px-3 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/20"
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Nuevo
        </Button>
      </summary>

      <div className="space-y-4 px-4 pb-5 md:px-5">
        {formOpen && (
          <div className="rounded-2xl border border-border bg-muted/10 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {editingProject ? 'Editar proyecto' : 'Nuevo proyecto'}
              </p>
              <button type="button" onClick={closeForm} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Nombre</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ej: Cliente Acme, Tesis..."
                  className="h-10 rounded-xl border-border bg-muted/20"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Categoría</Label>
                <Input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="Ej: Cliente, Personal, Curso"
                  className="h-10 rounded-xl border-border bg-muted/20"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Color</Label>
              <div className="flex gap-1.5 flex-wrap">
                {PROJECT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm({ ...form, color })}
                    className={cn(
                      'w-7 h-7 rounded-full border-2 transition-all',
                      form.color === color ? 'border-white scale-110' : 'border-transparent opacity-60 hover:opacity-100'
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSaving || !form.name.trim()}
              className="h-10 w-full rounded-xl bg-primary text-[10px] font-black uppercase tracking-widest text-primary-foreground"
            >
              {editingProject ? 'Actualizar Proyecto' : 'Crear Proyecto'}
            </Button>
          </div>
        )}

        {visibleProjects.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {visibleProjects.map((project) => (
              <div
                key={project.id}
                className="flex items-center gap-2 rounded-2xl border border-border bg-muted/20 pl-3 pr-1.5 py-1.5"
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: project.color }} />
                <span className="text-xs font-bold text-foreground">{project.name}</span>
                {project.category && (
                  <span className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/60">
                    {project.category}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => openEditForm(project)}
                  className="h-6 w-6 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-muted/40"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => onArchive(project.id)}
                  className="h-6 w-6 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                >
                  <Archive className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          !formOpen && (
            <p className="text-xs text-muted-foreground">Todavía no tienes proyectos. Crea uno para agrupar tareas y tickets.</p>
          )
        )}
      </div>
    </details>
  );
}
