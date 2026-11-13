export function initScrollReveal() {
    const elements = document.querySelectorAll(".reveal");

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("active");
                    observer.unobserve(entry.target);
                }
            });
        },
        {
            threshold: 0.15,
        }
    );

    elements.forEach((element) => observer.observe(element));

    return () => observer.disconnect();
}
