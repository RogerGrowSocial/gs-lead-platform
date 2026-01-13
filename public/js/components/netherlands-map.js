/**
 * Netherlands Leads Map Component
 * Modern, clean map chart showing leads per province
 * Uses D3.js for rendering
 */

class NetherlandsLeadsMap {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error(`Container with id "${containerId}" not found`);
      return;
    }

    this.options = {
      width: options.width || null, // null = use container width
      height: options.height || 400,
      colorScale: options.colorScale || ['#f3f4f6', '#fef3c7', '#fcd34d', '#f59e0b', '#ea5d0d'],
      showLegend: options.showLegend !== false,
      showLabels: options.showLabels !== false,
      ...options
    };

    this.data = null;
    this.geoData = null;
    this.svg = null;
    this.projection = null;
    this.path = null;
    this.tooltip = null;
    this.selectedProvince = null;

    this.init();
  }

  async init() {
    // Load GeoJSON data
    try {
      const response = await fetch('/data/netherlands-provinces.json');
      this.geoData = await response.json();
      this.render();
    } catch (error) {
      console.error('Error loading GeoJSON:', error);
      this.container.innerHTML = '<div style="padding: 20px; text-align: center; color: #ef4444;">Fout bij laden van kaartdata</div>';
    }
  }

  setData(leadsPerProvince) {
    /**
     * Set the leads data
     * @param {Array} leadsPerProvince - Array of { province: string, leads: number }
     * 
     * Example:
     * [
     *   { province: 'Noord-Brabant', leads: 120 },
     *   { province: 'Zuid-Holland', leads: 85 },
     *   ...
     * ]
     */
    this.data = leadsPerProvince;
    if (this.svg) {
      this.updateMap();
    }
  }

  render() {
    if (!this.geoData) return;

    // Clear container
    this.container.innerHTML = '';

    // Get container dimensions
    const containerWidth = this.options.width || this.container.clientWidth || 600;
    const containerHeight = this.options.height;

    // Create SVG
    this.svg = d3.select(this.container)
      .append('svg')
      .attr('width', containerWidth)
      .attr('height', containerHeight)
      .attr('viewBox', `0 0 ${containerWidth} ${containerHeight}`)
      .style('background', '#ffffff');

    // Create tooltip
    this.tooltip = d3.select('body')
      .append('div')
      .attr('class', 'netherlands-map-tooltip')
      .style('opacity', 0)
      .style('position', 'absolute')
      .style('background', 'rgba(0, 0, 0, 0.9)')
      .style('color', '#ffffff')
      .style('padding', '8px 12px')
      .style('border-radius', '6px')
      .style('font-size', '14px')
      .style('font-weight', '600')
      .style('pointer-events', 'none')
      .style('z-index', '1000')
      .style('box-shadow', '0 4px 6px rgba(0, 0, 0, 0.1)');

    // Set up projection (Mercator projection for Netherlands)
    this.projection = d3.geoMercator()
      .center([5.3, 52.1]) // Center on Netherlands
      .scale(2800)
      .translate([containerWidth / 2, containerHeight / 2]);

    this.path = d3.geoPath().projection(this.projection);

    // Draw map
    this.updateMap();

    // Add legend if enabled
    if (this.options.showLegend) {
      this.renderLegend();
    }

    // Handle window resize
    window.addEventListener('resize', () => {
      if (this.svg) {
        const newWidth = this.options.width || this.container.clientWidth || 600;
        this.svg.attr('width', newWidth);
        this.projection.translate([newWidth / 2, containerHeight / 2]);
        this.updateMap();
      }
    });
  }

  updateMap() {
    if (!this.svg || !this.geoData) return;

    // Create data map for quick lookup
    const dataMap = {};
    if (this.data) {
      this.data.forEach(item => {
        // Normalize province name for matching
        const normalizedName = this.normalizeProvinceName(item.province);
        dataMap[normalizedName] = item.leads || 0;
      });
    }

    // Calculate max leads for color scale
    const maxLeads = this.data ? Math.max(...this.data.map(d => d.leads || 0), 1) : 1;

    // Create color scale
    const colorScale = d3.scaleThreshold()
      .domain([0, maxLeads * 0.25, maxLeads * 0.5, maxLeads * 0.75])
      .range(this.options.colorScale);

    // Remove existing provinces
    this.svg.selectAll('.province').remove();

    // Draw provinces
    const provinces = this.svg.selectAll('.province')
      .data(this.geoData.features);

    const provinceEnter = provinces.enter()
      .append('path')
      .attr('class', 'province')
      .attr('d', this.path)
      .attr('fill', d => {
        const provinceName = d.properties.name;
        const normalizedName = this.normalizeProvinceName(provinceName);
        const leads = dataMap[normalizedName] || 0;
        return colorScale(leads);
      })
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .style('transition', 'all 0.2s ease')
      .on('mouseenter', (event, d) => {
        const provinceName = d.properties.name;
        const normalizedName = this.normalizeProvinceName(provinceName);
        const leads = dataMap[normalizedName] || 0;

        // Highlight province
        d3.select(event.currentTarget)
          .attr('stroke-width', 3)
          .attr('opacity', 0.85);

        // Show tooltip
        this.tooltip
          .html(`${provinceName}<br><strong>${leads} leads</strong>`)
          .style('opacity', 1);
      })
      .on('mousemove', (event) => {
        this.tooltip
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 40) + 'px');
      })
      .on('mouseleave', (event) => {
        // Remove highlight
        d3.select(event.currentTarget)
          .attr('stroke-width', 2)
          .attr('opacity', 1);

        // Hide tooltip
        this.tooltip.style('opacity', 0);
      })
      .on('click', (event, d) => {
        const provinceName = d.properties.name;
        const normalizedName = this.normalizeProvinceName(provinceName);
        const leads = dataMap[normalizedName] || 0;

        // Toggle selection
        if (this.selectedProvince === normalizedName) {
          this.selectedProvince = null;
          this.svg.selectAll('.province').attr('stroke-width', 2);
        } else {
          this.selectedProvince = normalizedName;
          this.svg.selectAll('.province').attr('stroke-width', 2);
          d3.select(event.currentTarget).attr('stroke-width', 4);
        }

        // Trigger custom event
        const customEvent = new CustomEvent('provinceSelected', {
          detail: { province: provinceName, leads: leads }
        });
        this.container.dispatchEvent(customEvent);
      });

    // Add labels if enabled
    if (this.options.showLabels) {
      this.svg.selectAll('.province-label').remove();
      
      this.svg.selectAll('.province-label')
        .data(this.geoData.features)
        .enter()
        .append('text')
        .attr('class', 'province-label')
        .attr('transform', d => {
          const centroid = this.path.centroid(d);
          return `translate(${centroid[0]}, ${centroid[1]})`;
        })
        .attr('text-anchor', 'middle')
        .attr('font-size', '11px')
        .attr('font-weight', '600')
        .attr('fill', '#1f2937')
        .attr('pointer-events', 'none')
        .text(d => d.properties.name);
    }
  }

  renderLegend() {
    if (!this.data || this.data.length === 0) return;

    const maxLeads = Math.max(...this.data.map(d => d.leads || 0), 1);
    const colorScale = d3.scaleThreshold()
      .domain([0, maxLeads * 0.25, maxLeads * 0.5, maxLeads * 0.75])
      .range(this.options.colorScale);

    const legendData = [
      { label: '0', value: 0 },
      { label: `1-${Math.ceil(maxLeads * 0.25)}`, value: maxLeads * 0.25 },
      { label: `${Math.ceil(maxLeads * 0.25) + 1}-${Math.ceil(maxLeads * 0.5)}`, value: maxLeads * 0.5 },
      { label: `${Math.ceil(maxLeads * 0.5) + 1}-${Math.ceil(maxLeads * 0.75)}`, value: maxLeads * 0.75 },
      { label: `${Math.ceil(maxLeads * 0.75) + 1}+`, value: maxLeads }
    ];

    // Remove existing legend
    this.svg.selectAll('.legend').remove();

    const legend = this.svg.append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${this.container.clientWidth - 150}, 20)`);

    legend.append('text')
      .attr('x', 0)
      .attr('y', 0)
      .attr('font-size', '12px')
      .attr('font-weight', '600')
      .attr('fill', '#374151')
      .text('Leads');

    legend.selectAll('.legend-item')
      .data(legendData)
      .enter()
      .append('g')
      .attr('class', 'legend-item')
      .attr('transform', (d, i) => `translate(0, ${20 + i * 25})`)
      .each(function(d, i) {
        const g = d3.select(this);
        
        g.append('rect')
          .attr('width', 20)
          .attr('height', 15)
          .attr('fill', colorScale(d.value))
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 1);

        g.append('text')
          .attr('x', 25)
          .attr('y', 12)
          .attr('font-size', '11px')
          .attr('fill', '#6b7280')
          .text(d.label);
      });
  }

  normalizeProvinceName(name) {
    /**
     * Normalize province name for matching
     * Handles variations like "Noord-Holland" vs "noord-holland" vs "Noord Holland"
     */
    if (!name) return '';
    
    const normalized = name.toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    // Map common variations
    const nameMap = {
      'noord-holland': 'noord-holland',
      'noordholland': 'noord-holland',
      'zuid-holland': 'zuid-holland',
      'zuidholland': 'zuid-holland',
      'noord-brabant': 'noord-brabant',
      'noordbrabant': 'noord-brabant',
      'gelderland': 'gelderland',
      'utrecht': 'utrecht',
      'friesland': 'friesland',
      'overijssel': 'overijssel',
      'groningen': 'groningen',
      'drenthe': 'drenthe',
      'flevoland': 'flevoland',
      'limburg': 'limburg',
      'zeeland': 'zeeland'
    };

    return nameMap[normalized] || normalized;
  }

  destroy() {
    if (this.tooltip) {
      this.tooltip.remove();
    }
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}

// Make available globally
window.NetherlandsLeadsMap = NetherlandsLeadsMap;

