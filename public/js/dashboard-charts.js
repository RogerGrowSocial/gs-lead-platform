// Dashboard Charts Initialization
function initializeDashboardCharts(leadsData, revenueData) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
    
    // Function to get data based on selected period
    function getDataForPeriod(data, period) {
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        
        switch(period) {
            case 'month':
                return {
                    labels: [months[currentMonth]],
                    data: [data[currentMonth]]
                };
            case 'quarter':
                const quarterStart = Math.floor(currentMonth / 3) * 3;
                return {
                    labels: months.slice(quarterStart, quarterStart + 3),
                    data: data.slice(quarterStart, quarterStart + 3)
                };
            case 'year':
            default:
                return {
                    labels: months,
                    data: data
                };
        }
    }

    // Function to initialize a chart
    function initializeChart(canvasId, type, colors, data) {
        const canvas = document.getElementById(canvasId);
        const ctx = canvas.getContext('2d');
        
        const chartConfig = {
            type: type,
            data: {
                labels: months,
                datasets: [{
                    label: canvasId === 'leadsChart' ? 'Aantal Aanvragen' : 'Omzet (€)',
                    data: data,
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    borderWidth: type === 'bar' ? 1 : 2,
                    borderRadius: type === 'bar' ? 4 : 0,
                    barThickness: type === 'bar' ? 12 : undefined,
                    tension: type === 'line' ? 0.4 : undefined,
                    fill: type === 'line',
                    pointBackgroundColor: type === 'line' ? colors.border : undefined,
                    pointBorderColor: type === 'line' ? '#fff' : undefined,
                    pointBorderWidth: type === 'line' ? 2 : undefined,
                    pointRadius: type === 'line' ? 4 : undefined,
                    pointHoverRadius: type === 'line' ? 6 : undefined
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            display: true,
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        ticks: canvasId === 'revenueChart' ? {
                            callback: function(value) {
                                return '€' + value;
                            }
                        } : undefined
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        };
        
        return new Chart(ctx, chartConfig);
    }

    // Initialize both charts
    const leadsChart = initializeChart('leadsChart', 'bar', {
        background: 'rgba(234, 88, 13, 0.7)',
        border: 'rgba(234, 88, 13, 1)'
    }, leadsData);
    
    const revenueChart = initializeChart('revenueChart', 'line', {
        background: 'rgba(16, 185, 129, 0.1)',
        border: 'rgba(16, 185, 129, 1)'
    }, revenueData);

    // Handle period button clicks
    document.querySelectorAll('.chart-actions button').forEach(button => {
        button.addEventListener('click', function() {
            const parent = this.closest('.chart-actions');
            parent.querySelector('.active').classList.remove('active');
            this.classList.add('active');
            
            const period = this.dataset.period;
            const chartId = parent.closest('.chart-card').querySelector('canvas').id;
            const chart = chartId === 'leadsChart' ? leadsChart : revenueChart;
            const data = chartId === 'leadsChart' ? leadsData : revenueData;
            
            const periodData = getDataForPeriod(data, period);
            chart.data.labels = periodData.labels;
            chart.data.datasets[0].data = periodData.data;
            chart.update();
        });
    });
} 