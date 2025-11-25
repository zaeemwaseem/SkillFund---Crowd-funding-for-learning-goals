// ============= Data Model & Storage =============

class Campaign {
    constructor(id, title, description, goal, category, deadline, createdAt = new Date()) {
        this.id = id;
        this.title = title;
        this.description = description;
        this.goal = goal;
        this.category = category;
        this.deadline = deadline;
        this.createdAt = createdAt;
        this.raised = 0;
        this.donors = [];
        this.comments = [];
    }

    addDonation(donorName, amount) {
        this.raised += parseFloat(amount);
        this.donors.push({ name: donorName, amount: parseFloat(amount), date: new Date() });
    }

    addComment(author, text) {
        this.comments.push({ author, text, timestamp: new Date() });
    }

    getProgress() {
        return Math.min((this.raised / this.goal) * 100, 100);
    }

    isCompleted() {
        return this.raised >= this.goal;
    }

    isExpired() {
        return new Date() > new Date(this.deadline);
    }
}

// Storage Manager
class StorageManager {
    static CAMPAIGNS_KEY = 'skillfund_campaigns';

    static getCampaigns() {
        const data = localStorage.getItem(this.CAMPAIGNS_KEY);
        if (!data) return [];
        
        const campaigns = JSON.parse(data);
        return campaigns.map(c => Object.assign(new Campaign(), c));
    }

    static saveCampaigns(campaigns) {
        localStorage.setItem(this.CAMPAIGNS_KEY, JSON.stringify(campaigns));
    }

    static addCampaign(campaign) {
        const campaigns = this.getCampaigns();
        campaigns.push(campaign);
        this.saveCampaigns(campaigns);
    }

    static updateCampaign(updatedCampaign) {
        const campaigns = this.getCampaigns();
        const index = campaigns.findIndex(c => c.id === updatedCampaign.id);
        if (index !== -1) {
            campaigns[index] = updatedCampaign;
            this.saveCampaigns(campaigns);
        }
    }

    static deleteCampaign(campaignId) {
        const campaigns = this.getCampaigns();
        const filtered = campaigns.filter(c => c.id !== campaignId);
        this.saveCampaigns(filtered);
    }

    static getCampaignById(campaignId) {
        const campaigns = this.getCampaigns();
        return campaigns.find(c => c.id === campaignId);
    }
}

// ============= App State =============

let currentFilter = 'all';
let editingCampaignId = null;

// ============= Initialization =============

document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    renderCampaigns();
    updateHeroStats();
    updateReports();
});

function initializeApp() {
    // Set minimum date for deadline picker to today
    const deadlineInput = document.getElementById('campaignDeadline');
    const today = new Date().toISOString().split('T')[0];
    deadlineInput.setAttribute('min', today);
}

// ============= Event Listeners =============

function setupEventListeners() {
    // Create campaign button
    document.getElementById('createCampaignBtn').addEventListener('click', openCreateCampaignModal);
    document.getElementById('footerCreateBtn').addEventListener('click', openCreateCampaignModal);
    
    // Campaign form submission
    document.getElementById('campaignForm').addEventListener('submit', handleCampaignSubmit);
    
    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.getAttribute('data-filter');
            renderCampaigns();
        });
    });

    // Modal reset on close
    const campaignModal = document.getElementById('campaignModal');
    campaignModal.addEventListener('hidden.bs.modal', resetCampaignForm);
}

// ============= Campaign CRUD Operations =============

function openCreateCampaignModal() {
    editingCampaignId = null;
    document.getElementById('campaignModalLabel').textContent = 'Create Campaign';
    document.getElementById('submitBtnText').textContent = 'Create Campaign';
    resetCampaignForm();
    const modal = new bootstrap.Modal(document.getElementById('campaignModal'));
    modal.show();
}

function openEditCampaignModal(campaignId) {
    editingCampaignId = campaignId;
    const campaign = StorageManager.getCampaignById(campaignId);
    
    if (!campaign) return;
    
    document.getElementById('campaignModalLabel').textContent = 'Edit Campaign';
    document.getElementById('submitBtnText').textContent = 'Update Campaign';
    
    document.getElementById('campaignId').value = campaign.id;
    document.getElementById('campaignTitle').value = campaign.title;
    document.getElementById('campaignDescription').value = campaign.description;
    document.getElementById('campaignGoal').value = campaign.goal;
    document.getElementById('campaignCategory').value = campaign.category;
    document.getElementById('campaignDeadline').value = new Date(campaign.deadline).toISOString().split('T')[0];
    
    const modal = new bootstrap.Modal(document.getElementById('campaignModal'));
    modal.show();
}

function handleCampaignSubmit(e) {
    e.preventDefault();
    
    const title = document.getElementById('campaignTitle').value.trim();
    const description = document.getElementById('campaignDescription').value.trim();
    const goal = parseFloat(document.getElementById('campaignGoal').value);
    const category = document.getElementById('campaignCategory').value;
    const deadline = document.getElementById('campaignDeadline').value;
    
    if (!title || !description || !goal || !category || !deadline) {
        alert('Please fill in all fields');
        return;
    }
    
    if (editingCampaignId) {
        // Update existing campaign
        const campaign = StorageManager.getCampaignById(editingCampaignId);
        campaign.title = title;
        campaign.description = description;
        campaign.goal = goal;
        campaign.category = category;
        campaign.deadline = deadline;
        
        StorageManager.updateCampaign(campaign);
        showNotification('Campaign updated successfully!', 'success');
    } else {
        // Create new campaign
        const campaign = new Campaign(
            Date.now().toString(),
            title,
            description,
            goal,
            category,
            deadline
        );
        
        StorageManager.addCampaign(campaign);
        showNotification('Campaign created successfully!', 'success');
    }
    
    // Close modal and refresh
    bootstrap.Modal.getInstance(document.getElementById('campaignModal')).hide();
    renderCampaigns();
    updateHeroStats();
    updateReports();
}

function deleteCampaign(campaignId) {
    if (!confirm('Are you sure you want to delete this campaign? This action cannot be undone.')) {
        return;
    }
    
    StorageManager.deleteCampaign(campaignId);
    showNotification('Campaign deleted successfully!', 'info');
    renderCampaigns();
    updateHeroStats();
    updateReports();
}

function resetCampaignForm() {
    document.getElementById('campaignForm').reset();
    editingCampaignId = null;
}

// ============= Campaign Rendering =============

function renderCampaigns() {
    const campaigns = StorageManager.getCampaigns();
    const container = document.getElementById('campaignsContainer');
    const noMessage = document.getElementById('noCampaignsMessage');
    
    // Filter campaigns
    const filteredCampaigns = currentFilter === 'all' 
        ? campaigns 
        : campaigns.filter(c => c.category === currentFilter);
    
    if (filteredCampaigns.length === 0) {
        container.style.display = 'none';
        noMessage.style.display = 'block';
        return;
    }
    
    container.style.display = 'grid';
    noMessage.style.display = 'none';
    
    container.innerHTML = filteredCampaigns.map(campaign => createCampaignCard(campaign)).join('');
    
    // Add event listeners
    filteredCampaigns.forEach(campaign => {
        document.getElementById(`view-${campaign.id}`).addEventListener('click', () => openCampaignDetails(campaign.id));
        document.getElementById(`edit-${campaign.id}`).addEventListener('click', (e) => {
            e.stopPropagation();
            openEditCampaignModal(campaign.id);
        });
        document.getElementById(`delete-${campaign.id}`).addEventListener('click', (e) => {
            e.stopPropagation();
            deleteCampaign(campaign.id);
        });
    });
}

function createCampaignCard(campaign) {
    const progress = campaign.getProgress();
    const progressClass = progress >= 75 ? 'high' : progress >= 40 ? 'medium' : 'low';
    const status = campaign.isCompleted() ? 'completed' : 'active';
    const statusText = campaign.isCompleted() ? 'Completed' : 'Active';
    
    const deadlineDate = new Date(campaign.deadline);
    const daysLeft = Math.ceil((deadlineDate - new Date()) / (1000 * 60 * 60 * 24));
    const deadlineText = daysLeft > 0 ? `${daysLeft} days left` : 'Expired';
    
    return `
        <div class="campaign-card" id="view-${campaign.id}">
            <div class="campaign-header">
                <span class="campaign-category">${campaign.category}</span>
                <div class="campaign-actions">
                    <button class="action-btn" id="edit-${campaign.id}" title="Edit">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="action-btn delete" id="delete-${campaign.id}" title="Delete">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </div>
            <h3 class="campaign-title">${escapeHtml(campaign.title)}</h3>
            <p class="campaign-description">${escapeHtml(campaign.description)}</p>
            <div class="campaign-progress">
                <div class="progress-info">
                    <span class="progress-amount">$${campaign.raised.toLocaleString()} / $${campaign.goal.toLocaleString()}</span>
                    <span class="progress-percentage">${progress.toFixed(0)}%</span>
                </div>
                <div class="progress-bar-container">
                    <div class="progress-bar-fill ${progressClass}" style="width: ${progress}%"></div>
                </div>
            </div>
            <div class="campaign-meta">
                <div class="campaign-deadline">
                    <i class="bi bi-calendar-event"></i>
                    <span>${deadlineText}</span>
                </div>
                <span class="campaign-status ${status}">${statusText}</span>
            </div>
        </div>
    `;
}

// ============= Campaign Details Modal =============

function openCampaignDetails(campaignId) {
    const campaign = StorageManager.getCampaignById(campaignId);
    if (!campaign) return;
    
    const modal = new bootstrap.Modal(document.getElementById('campaignDetailsModal'));
    const content = document.getElementById('campaignDetailsContent');
    
    const progress = campaign.getProgress();
    const progressClass = progress >= 75 ? 'high' : progress >= 40 ? 'medium' : 'low';
    
    content.innerHTML = `
        <div class="details-header">
            <h3 class="details-title">${escapeHtml(campaign.title)}</h3>
            <span class="campaign-category">${campaign.category}</span>
        </div>
        
        <div class="details-section">
            <h6><i class="bi bi-info-circle me-2"></i>Description</h6>
            <p class="campaign-description" style="-webkit-line-clamp: unset;">${escapeHtml(campaign.description)}</p>
        </div>
        
        <div class="details-section">
            <h6><i class="bi bi-bullseye me-2"></i>Funding Progress</h6>
            <div class="campaign-progress">
                <div class="progress-info">
                    <span class="progress-amount">$${campaign.raised.toLocaleString()} raised of $${campaign.goal.toLocaleString()} goal</span>
                    <span class="progress-percentage">${progress.toFixed(1)}%</span>
                </div>
                <div class="progress-bar-container" style="height: 12px;">
                    <div class="progress-bar-fill ${progressClass}" style="width: ${progress}%"></div>
                </div>
            </div>
            ${campaign.donors.length > 0 ? `
                <div class="donor-list">
                    ${campaign.donors.map(d => `<span class="donor-badge"><i class="bi bi-heart-fill me-1"></i>${escapeHtml(d.name)} - $${d.amount}</span>`).join('')}
                </div>
            ` : '<p class="text-muted mt-2">No donations yet. Be the first supporter!</p>'}
        </div>
        
        ${!campaign.isCompleted() ? `
        <div class="details-section">
            <h6><i class="bi bi-cash-coin me-2"></i>Make a Donation</h6>
            <div class="donation-form">
                <form id="donationForm">
                    <div class="mb-3">
                        <label for="donorName" class="form-label">Your Name</label>
                        <input type="text" class="form-control" id="donorName" required placeholder="Enter your name">
                    </div>
                    <div class="mb-3">
                        <label for="donationAmount" class="form-label">Donation Amount ($)</label>
                        <input type="number" class="form-control" id="donationAmount" min="1" required placeholder="Enter amount">
                    </div>
                    <button type="submit" class="btn btn-primary w-100">
                        <i class="bi bi-heart-fill me-2"></i>Donate Now
                    </button>
                </form>
            </div>
        </div>
        ` : '<div class="alert alert-success"><i class="bi bi-check-circle-fill me-2"></i>This campaign has reached its goal! 🎉</div>'}
        
        <div class="details-section">
            <h6><i class="bi bi-chat-dots me-2"></i>Comments (${campaign.comments.length})</h6>
            <form id="commentForm" class="comment-form">
                <div class="mb-2">
                    <input type="text" class="form-control mb-2" id="commentAuthor" required placeholder="Your name">
                    <textarea class="form-control mb-2" id="commentText" rows="2" required placeholder="Write a comment..."></textarea>
                    <button type="submit" class="btn btn-primary btn-sm">
                        <i class="bi bi-send me-1"></i>Post Comment
                    </button>
                </div>
            </form>
            <div class="comments-list">
                ${campaign.comments.length > 0 ? 
                    campaign.comments.slice().reverse().map(c => `
                        <div class="comment-item">
                            <div>
                                <span class="comment-author">${escapeHtml(c.author)}</span>
                                <span class="comment-time">${formatDate(c.timestamp)}</span>
                            </div>
                            <p class="comment-text">${escapeHtml(c.text)}</p>
                        </div>
                    `).join('') 
                    : '<p class="text-muted">No comments yet. Be the first to comment!</p>'}
            </div>
        </div>
    `;
    
    // Setup donation form
    const donationForm = document.getElementById('donationForm');
    if (donationForm) {
        donationForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleDonation(campaignId);
        });
    }
    
    // Setup comment form
    document.getElementById('commentForm').addEventListener('submit', (e) => {
        e.preventDefault();
        handleComment(campaignId);
    });
    
    modal.show();
}

// ============= Donation System =============

function handleDonation(campaignId) {
    const donorName = document.getElementById('donorName').value.trim();
    const amount = parseFloat(document.getElementById('donationAmount').value);
    
    if (!donorName || !amount || amount <= 0) {
        alert('Please enter valid donation details');
        return;
    }
    
    const campaign = StorageManager.getCampaignById(campaignId);
    campaign.addDonation(donorName, amount);
    StorageManager.updateCampaign(campaign);
    
    showNotification(`Thank you ${donorName} for donating $${amount}!`, 'success');
    
    // Refresh displays
    openCampaignDetails(campaignId);
    renderCampaigns();
    updateHeroStats();
    updateReports();
}

// ============= Comment System =============

function handleComment(campaignId) {
    const author = document.getElementById('commentAuthor').value.trim();
    const text = document.getElementById('commentText').value.trim();
    
    if (!author || !text) {
        alert('Please fill in all comment fields');
        return;
    }
    
    const campaign = StorageManager.getCampaignById(campaignId);
    campaign.addComment(author, text);
    StorageManager.updateCampaign(campaign);
    
    showNotification('Comment posted successfully!', 'success');
    
    // Refresh
    openCampaignDetails(campaignId);
}

// ============= Statistics & Reports =============

function updateHeroStats() {
    const campaigns = StorageManager.getCampaigns();
    const totalCampaigns = campaigns.length;
    const totalRaised = campaigns.reduce((sum, c) => sum + c.raised, 0);
    const totalDonors = campaigns.reduce((sum, c) => sum + c.donors.length, 0);
    
    document.getElementById('heroTotalCampaigns').textContent = totalCampaigns;
    document.getElementById('heroTotalRaised').textContent = `$${totalRaised.toLocaleString()}`;
    document.getElementById('heroTotalDonors').textContent = totalDonors;
    
    // Footer stats
    document.getElementById('footerCampaignCount').textContent = totalCampaigns;
    document.getElementById('footerTotalRaised').textContent = `$${totalRaised.toLocaleString()}`;
}

function updateReports() {
    const campaigns = StorageManager.getCampaigns();
    const totalCampaigns = campaigns.length;
    const totalDonations = campaigns.reduce((sum, c) => sum + c.raised, 0);
    const averageDonation = totalCampaigns > 0 ? totalDonations / totalCampaigns : 0;
    const completedCampaigns = campaigns.filter(c => c.isCompleted()).length;
    
    document.getElementById('reportTotalCampaigns').textContent = totalCampaigns;
    document.getElementById('reportTotalDonations').textContent = `$${totalDonations.toLocaleString()}`;
    document.getElementById('reportAverageDonation').textContent = `$${averageDonation.toLocaleString(undefined, {maximumFractionDigits: 0})}`;
    document.getElementById('reportCompletedCampaigns').textContent = completedCampaigns;
    
    // Top campaigns
    renderTopCampaigns(campaigns);
}

function renderTopCampaigns(campaigns) {
    const container = document.getElementById('topCampaignsContainer');
    
    if (campaigns.length === 0) {
        container.innerHTML = '<p class="text-muted">No campaigns available yet.</p>';
        return;
    }
    
    const topCampaigns = campaigns
        .sort((a, b) => b.raised - a.raised)
        .slice(0, 3);
    
    container.innerHTML = topCampaigns.map((campaign, index) => `
        <div class="top-campaign-item">
            <div class="top-campaign-rank">${index + 1}</div>
            <div class="top-campaign-info">
                <div class="top-campaign-title">${escapeHtml(campaign.title)}</div>
                <div class="top-campaign-category">${campaign.category}</div>
            </div>
            <div class="top-campaign-amount">$${campaign.raised.toLocaleString()}</div>
        </div>
    `).join('');
}

// ============= Utility Functions =============

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return date.toLocaleDateString();
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' : 
                     type === 'info' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 
                     'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        z-index: 9999;
        animation: slideInRight 0.3s ease;
        font-weight: 500;
        max-width: 300px;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add notification animations to CSS dynamically
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
