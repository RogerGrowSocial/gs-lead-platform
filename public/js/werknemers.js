function filterEmployees(){
  const q=(document.getElementById('searchInput')?.value||'').toLowerCase();
  const dep=(document.getElementById('departmentFilter')?.value||'all');
  document.querySelectorAll('.werknemer-item').forEach(item=>{
    const name=item.dataset.name||'';
    const role=item.dataset.role||'';
    const department=item.dataset.department||'';
    const matchSearch=!q||name.includes(q)||role.includes(q)||department.includes(q);
    const matchDep=dep==='all'||department===dep;
    item.style.display=(matchSearch&&matchDep)?'block':'none';
  });
}
function openNewEmployeeModal(){alert('Open nieuwe werknemer modal');}


