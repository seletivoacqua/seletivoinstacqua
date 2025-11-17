// services/userService.ts
export async function getAnalysts(): Promise<Analyst[]> {
  try {
    // Sua implementação atual
    const response = await fetch('/api/analysts');
    const data = await response.json();
    return data.analysts || [];
  } catch (error) {
    console.error('Erro em getAnalysts:', error);
    return [];
  }
}

export async function getInterviewers(): Promise<Analyst[]> {
  try {
    // Sua implementação atual  
    const response = await fetch('/api/interviewers');
    const data = await response.json();
    return data.interviewers || [];
  } catch (error) {
    console.error('Erro em getInterviewers:', error);
    return [];
  }
}
